// Source of the method: https://github.com/root-project/root/blob/v6-40-04/hist/spectrum/src/TSpectrum.cxx#L504 (tag v6-40-04 of the ROOT repository).
// Writes the background that TSpectrum::Background of ROOT computes for each array of an input file, for the reference file of the
// analyzer (generate-references.py runs it as: root -l -b -q 'root_background.C("in.txt", "out.txt")').
// Input: for each case a line "iterations direction n" (direction 0 rising window, 1 falling window) and a line of n values.
// Output: for each case a line of the n values of the background, written with 17 significant digits, or a line "ERROR" and the
// message that ROOT returns when it does not compute the background (it leaves the values as they are then).
#include <fstream>
#include <vector>

void root_background(const char *in, const char *out)
{
   std::ifstream input(in);
   std::ofstream output(out);
   output.precision(17);
   int iterations, direction, n;
   while (input >> iterations >> direction >> n) {
      std::vector<double> values(n);
      for (int i = 0; i < n; i++) input >> values[i];
      TSpectrum spectrum;
      const char *message = spectrum.Background(values.data(), n, iterations, direction, TSpectrum::kBackOrder2, kFALSE, TSpectrum::kBackSmoothing3, kFALSE);
      if (message) {
         output << "ERROR " << message << "\n";
         continue;
      }
      for (int i = 0; i < n; i++) output << values[i] << (i + 1 < n ? " " : "\n");
   }
}
