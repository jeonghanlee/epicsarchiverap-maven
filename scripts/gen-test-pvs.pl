#!/usr/bin/perl
# Writes a set of test PVs: an EPICS database of calc records for a soft IOC and the list of their names.
# A sector holds 8 BPMs of 5 fields each (40 PVs): SR:C01:BPM1:X, SR:C01:BPM1:Y, ... SR:C02:BPM1:X, ...
# Usage: gen-test-pvs.pl --count N [--db FILE] [--names FILE]
use strict;
use warnings;
use Getopt::Long qw(GetOptions);

use constant FIELDS     => qw(X Y S T U);
use constant BPMS       => 8;
use constant PER_SECTOR => 40;

sub usage {
    print STDERR "Usage: $0 --count N [--db FILE] [--names FILE]\n";
    print STDERR "  --count N    number of PVs, 40 per sector (default 1000)\n";
    print STDERR "  --db FILE    write the soft IOC database to FILE\n";
    print STDERR "  --names FILE write one PV name per line to FILE\n";
    return;
}

sub write_file {
    my ($path, $text) = @_;
    open my $out, '>', $path or die "$0: cannot write $path: $!\n";
    print {$out} $text or die "$0: cannot write $path: $!\n";
    close $out or die "$0: cannot write $path: $!\n";
    return;
}

my ($count, $db, $names, $help) = (1000, undef, undef, 0);
GetOptions('count=i' => \$count, 'db=s' => \$db, 'names=s' => \$names, 'help' => \$help) or do { usage(); exit 2 };
if ($help) { usage(); exit 0 }
if ($count < 1) { print STDERR "$0: --count must be at least 1\n"; exit 2 }
if (!defined $db && !defined $names) { usage(); exit 2 }

my @fields = (FIELDS);
my (@pv, @record);
SECTOR: for my $sector (1 .. int(($count + PER_SECTOR - 1) / PER_SECTOR)) {
    for my $bpm (1 .. BPMS) {
        for my $at (0 .. $#fields) {
            last SECTOR if @pv >= $count;
            my $name = sprintf 'SR:C%02d:BPM%d:%s', $sector, $bpm, $fields[$at];
            push @pv, $name;
            push @record, sprintf qq{record(calc, "%s") { field(EGU, "V") field(PREC, "1") field(SCAN, "1 second") field(INPA, "%s") field(CALC, "A+%d") }\n}, $name, $name, $at + 1;
        }
    }
}
write_file($db, join '', @record) if defined $db;
write_file($names, join '', map { "$_\n" } @pv) if defined $names;
exit 0;
