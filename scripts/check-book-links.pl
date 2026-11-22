#!/usr/bin/perl
# Checks the links of a generated mdBook: every relative href or src names a file of the output, a link that starts with the
# site-url of book.toml is resolved against the root of the output, and every #fragment is an id or name of its target page.
# Usage: check-book-links.pl OUTPUT_DIR [SITE_URL]   (SITE_URL defaults to /epicsarchiverap-maven/)
# Exit status: 0 when every link resolves, 1 when a link fails, 2 on a usage error.
use strict;
use warnings;
use File::Find qw(find);
use File::Spec ();
use Cwd qw(abs_path);

my %ENTITY = (amp => '&', lt => '<', gt => '>', quot => '"', apos => "'");

sub decode {
    my ($text) = @_;
    $text =~ s/&#x([0-9a-fA-F]+);/chr hex $1/ge;
    $text =~ s/&#([0-9]+);/chr $1/ge;
    $text =~ s/&([a-z]+);/exists $ENTITY{$1} ? $ENTITY{$1} : "&$1;"/ge;
    return $text;
}

sub normalize {
    my ($path) = @_;
    my @out;
    for my $part (split m{/}, $path) {
        next if $part eq '' || $part eq '.';
        if ($part eq '..') { pop @out; next }
        push @out, $part;
    }
    return ($path =~ m{^/} ? '/' : '') . join '/', @out;
}

sub read_page {
    my ($path) = @_;
    open my $in, '<:encoding(UTF-8)', $path or die "$0: cannot read $path: $!\n";
    local $/;
    my $html = <$in>;
    close $in;
    $html =~ s/<!--.*?-->//gs;
    $html =~ s{(<(script|style)\b[^>]*>).*?(</\2\s*>)}{$1$3}gis;
    return $html;
}

# Returns (\%ids, \@links) of one page; links are [value] of href and src attributes that are not external.
sub scan {
    my ($path) = @_;
    my (%ids, @links);
    my $html = read_page($path);
    while ($html =~ /<([a-zA-Z][a-zA-Z0-9-]*)((?:[^>"']|"[^"]*"|'[^']*')*)>/g) {
        my $attrs = $2;
        while ($attrs =~ /([a-zA-Z_:][-a-zA-Z0-9_:.]*)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g) {
            my ($key, $value) = (lc $1, decode(defined $2 ? $2 : defined $3 ? $3 : defined $4 ? $4 : ''));
            if (($key eq 'id' || $key eq 'name') && $value ne '') { $ids{$value} = 1 }
            if (($key eq 'href' || $key eq 'src') && $value ne '' && $value !~ m{^(?:https?:|mailto:|data:|javascript:|//)}i) { push @links, $value }
        }
    }
    return (\%ids, \@links);
}

my ($dir, $site) = @ARGV;
if (!defined $dir || @ARGV > 2) { print STDERR "Usage: $0 OUTPUT_DIR [SITE_URL]\n"; exit 2 }
$site = '/epicsarchiverap-maven/' unless defined $site;
my $root = abs_path($dir);
if (!defined $root || !-d $root) { print STDERR "$0: not a directory: $dir\n"; exit 2 }

my @pages;
find({ no_chdir => 1, wanted => sub { push @pages, $File::Find::name if -f $_ && /\.html\z/ } }, $root);
@pages = sort @pages;

my (%ids, @links);
for my $page (@pages) {
    my ($page_ids, $page_links) = scan($page);
    $ids{$page} = $page_ids;
    push @links, map { [$page, $_] } @{$page_links};
}

my @failures;
for my $link (@links) {
    my ($page, $value) = @{$link};
    my ($path, $fragment) = split /#/, $value, 2;
    $path = '' unless defined $path;
    my $target;
    if (length $path && index($path, $site) == 0) {
        my $rest = substr $path, length $site;
        $target = normalize("$root/" . (length $rest ? $rest : 'index.html'));
    } elsif ($path =~ m{^/}) {
        push @failures, [$page, $value, 'root-relative link outside the site-url'];
        next;
    } elsif (length $path) {
        my ($volume, $directory) = File::Spec->splitpath($page);
        $target = normalize($directory . $path);
    } else {
        $target = $page;
    }
    $target = "$target/index.html" if -d $target;
    if (!-e $target) {
        push @failures, [$page, $value, 'no such file'];
    } elsif (defined $fragment && length $fragment && $target =~ /\.html\z/) {
        if (!exists $ids{$target}) { ($ids{$target}) = scan($target) }
        push @failures, [$page, $value, 'no such id'] unless $ids{$target}{decode($fragment)} || $ids{$target}{$fragment};
    }
}
for my $failure (@failures) {
    my ($page, $value, $why) = @{$failure};
    printf "FAIL %s %s %s\n", File::Spec->abs2rel($page, $root), $value, $why;
}
printf "checked %d links in %d pages, %d fail\n", scalar @links, scalar @pages, scalar @failures;
exit(@failures ? 1 : 0);
