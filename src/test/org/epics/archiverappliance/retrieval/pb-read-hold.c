#define _GNU_SOURCE
#include <dlfcn.h>
#include <errno.h>
#include <fcntl.h>
#include <limits.h>
#include <stdio.h>
#include <stdlib.h>
#include <sys/stat.h>
#include <sys/syscall.h>
#include <time.h>
#include <unistd.h>

/* Delay only sequential reads of the selected real PB inode in this process. */
static ssize_t (*next_read)(int, void *, size_t);
static char control[PATH_MAX];
static dev_t target_device;
static ino_t target_inode;
static int configured;
static const off_t sequential_minimum = 65536;
static const double hold_timeout_seconds = 20.0;
static __thread int previous_fd = -1;
static __thread off_t previous_end = -1;
static __thread off_t sequential_bytes;

static double monotonic_seconds(void) {
    struct timespec now;
    clock_gettime(CLOCK_MONOTONIC, &now);
    return now.tv_sec + now.tv_nsec / 1e9;
}

static int control_path(char *out, size_t size, const char *name) {
    int length = snprintf(out, size, "%s/%s", control, name);
    return length > 0 && (size_t)length < size;
}

static off_t read_limit(void) {
    char path[PATH_MAX], value[64];
    if (!control_path(path, sizeof(path), "limit")) return -1;
    int fd = open(path, O_RDONLY | O_CLOEXEC);
    if (fd < 0) return -1;
    ssize_t size = syscall(SYS_read, fd, value, sizeof(value) - 1);
    close(fd);
    if (size <= 0) return -1;
    value[size] = '\0';
    char *end;
    long long limit = strtoll(value, &end, 10);
    return end != value && limit > 0 ? (off_t)limit : -1;
}

static void event(const char *kind, off_t offset) {
    char path[PATH_MAX], line[256];
    if (!control_path(path, sizeof(path), "events.log")) return;
    int length = snprintf(line, sizeof(line), "%s pid=%ld tid=%ld offset=%lld time=%.9f\n",
            kind, (long)getpid(), syscall(SYS_gettid), (long long)offset, monotonic_seconds());
    if (length <= 0 || (size_t)length >= sizeof(line)) return;
    int fd = open(path, O_WRONLY | O_CREAT | O_APPEND | O_CLOEXEC, 0600);
    if (fd >= 0) {
        syscall(SYS_write, fd, line, (size_t)length);
        close(fd);
    }
}

__attribute__((constructor)) static void initialize(void) {
    next_read = dlsym(RTLD_NEXT, "read");
    const char *directory = getenv("ARCHAPPL_TEST_READ_CONTROL");
    const char *target = getenv("ARCHAPPL_TEST_READ_TARGET");
    struct stat attributes;
    if (!directory || !target || stat(target, &attributes) != 0) return;
    int length = snprintf(control, sizeof(control), "%s", directory);
    if (length <= 0 || (size_t)length >= sizeof(control)) return;
    target_device = attributes.st_dev;
    target_inode = attributes.st_ino;
    configured = 1;
    event("LOADED", 0);
}

ssize_t read(int fd, void *buffer, size_t count) {
    int saved_errno = errno;
    struct stat attributes;
    off_t offset = -1;
    int target = configured && fstat(fd, &attributes) == 0
            && attributes.st_dev == target_device && attributes.st_ino == target_inode;
    if (target) {
        offset = lseek(fd, 0, SEEK_CUR);
        if (fd != previous_fd || offset != previous_end) sequential_bytes = 0;
        off_t limit = read_limit();
        if (offset >= limit && limit > 0 && sequential_bytes >= sequential_minimum) {
            char name[128], marker[PATH_MAX];
            snprintf(name, sizeof(name), "held.%ld.%ld", (long)getpid(), syscall(SYS_gettid));
            if (control_path(marker, sizeof(marker), name)) {
                int receipt = open(marker, O_WRONLY | O_CREAT | O_TRUNC | O_CLOEXEC, 0600);
                if (receipt >= 0) {
                    char value[64];
                    int size = snprintf(value, sizeof(value), "%lld\n", (long long)offset);
                    syscall(SYS_write, receipt, value, (size_t)size);
                    close(receipt);
                }
                event("BLOCK", offset);
                double start = monotonic_seconds();
                const struct timespec interval = {.tv_sec = 0, .tv_nsec = 10000000};
                while ((limit = read_limit()) > 0 && offset >= limit
                        && monotonic_seconds() - start < hold_timeout_seconds) {
                    nanosleep(&interval, NULL);
                }
                event(limit > 0 && offset >= limit ? "EXPIRED" : "RELEASE", offset);
                unlink(marker);
            }
        }
    }
    errno = saved_errno;
    ssize_t result = next_read ? next_read(fd, buffer, count) : syscall(SYS_read, fd, buffer, count);
    if (target) {
        previous_fd = fd;
        previous_end = offset + (result > 0 ? result : 0);
        sequential_bytes += result > 0 ? result : 0;
    }
    return result;
}
