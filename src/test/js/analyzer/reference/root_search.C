// Source of the method: https://github.com/root-project/root/blob/v6-40-04/hist/spectrum/src/TSpectrum.cxx#L2118 (tag v6-40-04 of the ROOT repository).
// Writes the peaks that SearchHighRes of ROOT (the engine of TSpectrum::Search) finds in each array of an input file, for the reference
// file of the analyzer (generate-references.py runs it as: root -l -b -q 'root_search.C("in.txt", "out.txt")').
// Input: for each case a line "sigma threshold background markov iterations window maxPeaks n" (threshold in percent of the highest peak,
// background and markov 0 or 1) and a line of n values.
// Output: for each case a line "count x1 x2 ..." with the positions in elements (17 significant digits), and a line of the n values of the
// deconvolved spectrum that the search leaves in its destination vector; a failed call (it returns 0 peaks and writes an error) gives
// the same two lines with a count of 0.
#include <fstream>
#include <vector>

void root_search(const char *in, const char *out)
{
   std::ifstream input(in);
   std::ofstream output(out);
   output.precision(17);
   double sigma, threshold;
   int background, markov, iterations, window, maxPeaks, n;
   while (input >> sigma >> threshold >> background >> markov >> iterations >> window >> maxPeaks >> n) {
      std::vector<double> values(n), destination(n, 0.0);
      for (int i = 0; i < n; i++) input >> values[i];
      TSpectrum spectrum(maxPeaks);
      int found = spectrum.SearchHighRes(values.data(), destination.data(), n, sigma, threshold, background != 0, iterations, markov != 0, window);
      output << found;
      for (int i = 0; i < found; i++) output << " " << spectrum.GetPositionX()[i];
      output << "\n";
      for (int i = 0; i < n; i++) output << destination[i] << (i + 1 < n ? " " : "\n");
   }
}
