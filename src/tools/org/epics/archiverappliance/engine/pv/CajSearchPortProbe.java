package org.epics.archiverappliance.engine.pv;

import com.cosylab.epics.caj.CAJContext;

import java.io.IOException;
import java.net.InetSocketAddress;
import java.nio.channels.DatagramChannel;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

/**
 * Counts how often a set of CA search sockets opened in one JVM ends up sharing a UDP port.
 *
 * <p>Each round opens CONTEXTS sockets, records their local ports, closes them and counts the round
 * as shared when two sockets hold one port. Mode {@code caj} creates real {@link CAJContext}s and
 * initializes them, as each engine command thread does, and reads the port of each context's
 * search (broadcast) transport. Modes {@code reuse} and {@code noreuse} open {@link DatagramChannel}s
 * as CAJ's BroadcastConnector and CAJContext.initializeUDPTransport do (non-blocking, broadcast,
 * bound to port 0), with and without SO_REUSEADDR. Mode {@code deliver} repeats {@code reuse} rounds
 * until two channels share a port, then sends DATAGRAMS unicast datagrams to that port on loopback
 * and reports how many each sharing channel received. CAJ is limited to loopback addressing so the
 * probe sends nothing beyond the host.
 *
 * <p>Usage: {@code java -cp jca-2.4.12.jar CajSearchPortProbe.java <caj|reuse|noreuse|deliver> <rounds> [contexts]}
 * prints one summary line with the kernel release, the JDK, the mode, the rounds, the rounds with a
 * shared port and the first shared port seen.
 */
public class CajSearchPortProbe {
    private static final int DEFAULT_CONTEXTS = 10;
    private static final int DATAGRAMS = 100;

    public static void main(String[] args) throws Exception {
        if (args.length < 2) {
            System.err.println("usage: CajSearchPortProbe <caj|reuse|noreuse|deliver> <rounds> [contexts]");
            System.exit(2);
        }
        String mode = args[0];
        int rounds = Integer.parseInt(args[1]);
        int contexts = args.length > 2 ? Integer.parseInt(args[2]) : DEFAULT_CONTEXTS;
        System.setProperty("com.cosylab.epics.caj.CAJContext.auto_addr_list", "false");
        System.setProperty("com.cosylab.epics.caj.CAJContext.addr_list", "127.0.0.1");
        if (mode.equals("deliver")) {
            deliver(rounds, contexts);
            return;
        }
        int sharedRounds = 0;
        String firstShared = "none";
        for (int round = 0; round < rounds; round++) {
            List<Integer> ports = switch (mode) {
                case "caj" -> cajPorts(contexts);
                case "reuse" -> channelPorts(contexts, true);
                case "noreuse" -> channelPorts(contexts, false);
                default -> throw new IllegalArgumentException("unknown mode " + mode);
            };
            Set<Integer> distinct = new HashSet<>(ports);
            if (distinct.size() < ports.size()) {
                sharedRounds++;
                if (firstShared.equals("none")) {
                    firstShared = "round " + round + " ports " + ports;
                }
            }
        }
        String kernel = Files.readString(Path.of("/proc/sys/kernel/osrelease")).trim();
        System.out.printf("kernel=%s java=%s mode=%s contexts=%d rounds=%d shared_rounds=%d first_shared=%s%n",
                kernel, System.getProperty("java.runtime.version"), mode, contexts, rounds, sharedRounds,
                firstShared);
    }

    /** Finds a shared port among reuse channels and reports which sharing channel receives unicast datagrams. */
    private static void deliver(int rounds, int count) throws Exception {
        for (int round = 0; round < rounds; round++) {
            List<DatagramChannel> opened = new ArrayList<>();
            try {
                for (int i = 0; i < count; i++) {
                    DatagramChannel channel = DatagramChannel.open();
                    opened.add(channel);
                    channel.configureBlocking(false);
                    channel.socket().setBroadcast(true);
                    channel.socket().setReuseAddress(true);
                    channel.socket().bind(new InetSocketAddress(0));
                }
                for (int a = 0; a < count; a++) {
                    for (int b = a + 1; b < count; b++) {
                        int port = opened.get(a).socket().getLocalPort();
                        if (port != opened.get(b).socket().getLocalPort()) {
                            continue;
                        }
                        try (DatagramChannel sender = DatagramChannel.open()) {
                            for (int n = 0; n < DATAGRAMS; n++) {
                                sender.send(java.nio.ByteBuffer.wrap(new byte[] {1}), new InetSocketAddress("127.0.0.1", port));
                            }
                        }
                        Thread.sleep(200);
                        int first = drain(opened.get(a));
                        int second = drain(opened.get(b));
                        System.out.printf("kernel=%s round=%d port=%d earlier_bound_socket_received=%d later_bound_socket_received=%d sent=%d%n",
                                Files.readString(Path.of("/proc/sys/kernel/osrelease")).trim(), round, port, first, second,
                                DATAGRAMS);
                        return;
                    }
                }
            } finally {
                for (DatagramChannel channel : opened) {
                    channel.close();
                }
            }
        }
        System.out.printf("no shared port in %d rounds%n", rounds);
    }

    /** Counts the datagrams waiting on a non-blocking channel. */
    private static int drain(DatagramChannel channel) throws IOException {
        int received = 0;
        java.nio.ByteBuffer buffer = java.nio.ByteBuffer.allocate(16);
        while (channel.receive(buffer) != null) {
            received++;
            buffer.clear();
        }
        return received;
    }

    /** Creates and initializes real CAJ contexts and returns the local port of each search transport. */
    private static List<Integer> cajPorts(int count) throws Exception {
        List<CAJContext> opened = new ArrayList<>();
        List<Integer> ports = new ArrayList<>();
        try {
            for (int i = 0; i < count; i++) {
                CAJContext context = new CAJContext();
                opened.add(context);
                context.initialize();
                ports.add(context.getBroadcastTransport().getChannel().socket().getLocalPort());
            }
        } finally {
            for (CAJContext context : opened) {
                context.destroy();
            }
        }
        return ports;
    }

    /** Opens datagram channels bound as CAJ binds its search socket and returns their local ports. */
    private static List<Integer> channelPorts(int count, boolean reuseAddress) throws IOException {
        List<DatagramChannel> opened = new ArrayList<>();
        List<Integer> ports = new ArrayList<>();
        try {
            for (int i = 0; i < count; i++) {
                DatagramChannel channel = DatagramChannel.open();
                opened.add(channel);
                channel.configureBlocking(false);
                channel.socket().setBroadcast(true);
                channel.socket().setReuseAddress(reuseAddress);
                channel.socket().bind(new InetSocketAddress(0));
                ports.add(channel.socket().getLocalPort());
            }
        } finally {
            for (DatagramChannel channel : opened) {
                channel.close();
            }
        }
        return ports;
    }
}
