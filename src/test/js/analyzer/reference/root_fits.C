// Generates the fits of the reference file root-fits.json of the analyzer: the data of each case (TRandom3 with a fixed seed) and the
// fit that ROOT (6.36.10) makes of it. Run as: root -l -b -q 'root_fits.C("root-fits.json")'.
// A graph is fitted by TGraph::Fit without error bars (the errors are the covariance scaled by chi2/ndf); a histogram by TH1::Fit with
// the option I (the function is integrated over each bin and its mean over the bin is the expected value) and the errors sqrt(content),
// the empty bins being left out as ROOT leaves them. The minimizer is Minuit2 with Migrad, and every fit is made twice: from the
// start values at the defaults of ROOT (the tolerance 0.01 and the strategy 1), then from that result at the strategy
// REFINED_STRATEGY and the tolerance REFINED_TOLERANCE times the chi-square, so that the fit stops at the minimum of its chi-square
// whatever the scale of the data; the values written are those of the second fit, its covariance as Minuit2 reports it.
// Models (those of aa/fit.js): line pol1, polynomial2 pol2, exponential a*exp(b*x), power a*x^b, logarithm a+b*log(x),
// sine a*sin(2*pi*f*x+phi)+c, gaussian a*exp(-(x-mu)^2/(2*sigma^2))+c, landau a*landau((x-mpv)/w)/w+c.
// The image case holds an image of one Gaussian blob and, for three regions, the Gaussian fit of the X and of the Y projection from
// the start that aa/image.js makes of the data, with the width and the full width at half maximum of each.
#include <fstream>
#include <sstream>
#include <string>
#include <vector>

static const double REFINED_TOLERANCE = 1e-8;
static const int REFINED_STRATEGY = 2;

static std::filebuf fileBuffer;
static std::ostream out(nullptr);

static const char *formula_of(const std::string &kind)
{
   if (kind == "line") return "pol1";
   if (kind == "polynomial2") return "pol2";
   if (kind == "exponential") return "[0]*exp([1]*x)";
   if (kind == "power") return "[0]*pow(x,[1])";
   if (kind == "logarithm") return "[0]+[1]*log(x)";
   if (kind == "sine") return "[0]*sin(2*pi*[1]*x+[2])+[3]";
   if (kind == "gaussian") return "[0]*exp(-0.5*pow((x-[1])/[2],2))+[3]";
   if (kind == "landau") return "[0]*TMath::Landau(x,[1],[2],1)+[3]";
   return nullptr;
}

static void put_array(const std::vector<double> &v)
{
   out << "[";
   for (size_t i = 0; i < v.size(); i++) out << (i ? "," : "") << v[i];
   out << "]";
}

static std::vector<double> grid(double from, double to, int n)
{
   std::vector<double> v(n);
   for (int i = 0; i < n; i++) v[i] = from + (to - from) * i / (n - 1);
   return v;
}

// Fits data (a graph or a histogram) with f at the defaults of ROOT, then again from that result at the refined settings. Minuit2
// compares its estimated distance to the minimum with the tolerance in the units of the chi-square, which for a graph without error
// bars are those of the data squared, so the refined tolerance is taken relative to the chi-square of the first fit.
template <class Data> static TFitResultPtr fit_twice(Data &data, TF1 &f, const char *option)
{
   const double tolerance = ROOT::Math::MinimizerOptions::DefaultTolerance();
   const int strategy = ROOT::Math::MinimizerOptions::DefaultStrategy();
   TFitResultPtr first = data.Fit(&f, option);
   ROOT::Math::MinimizerOptions::SetDefaultTolerance(REFINED_TOLERANCE * first->Chi2());
   ROOT::Math::MinimizerOptions::SetDefaultStrategy(REFINED_STRATEGY);
   TFitResultPtr refined = data.Fit(&f, option);
   ROOT::Math::MinimizerOptions::SetDefaultTolerance(tolerance);
   ROOT::Math::MinimizerOptions::SetDefaultStrategy(strategy);
   return refined;
}

struct Spec {
   std::string kind;
   std::vector<double> start;
   std::vector<int> fixed;
   std::vector<std::vector<double>> limits; // index, low, high
};

// Writes the object of one fit: parameters, errors, covariance, chi2, ndf, status, R squared (a graph) and the band at the points bandX.
static void write_fit(TFitResultPtr &r, TF1 &f, const std::vector<double> &y, bool graph, const std::vector<double> &bandX, const std::vector<double> &x)
{
   const int npar = f.GetNpar();
   std::vector<double> p(npar), e(npar), free;
   for (int k = 0; k < npar; k++) { p[k] = r->Parameter(k); e[k] = r->ParError(k); }
   out << "{\"params\":"; put_array(p);
   out << ",\"errors\":"; put_array(e);
   out << ",\"covariance\":[";
   for (int a = 0; a < npar; a++) {
      out << (a ? "," : "") << "[";
      for (int b = 0; b < npar; b++) out << (b ? "," : "") << r->CovMatrix(a, b);
      out << "]";
   }
   out << "],\"chi2\":" << r->Chi2() << ",\"ndf\":" << r->Ndf() << ",\"status\":" << (int)r;
   if (graph) {
      double mean = 0, tot = 0;
      for (double v : y) mean += v / y.size();
      for (double v : y) tot += (v - mean) * (v - mean);
      out << ",\"rSquared\":" << 1 - r->Chi2() / tot;
   }
   if (!bandX.empty()) {
      std::vector<double> sigma;
      for (double xv : bandX) {
         std::vector<double> g(npar);
         f.GradientPar(&xv, g.data());
         double s = 0;
         for (int a = 0; a < npar; a++)
            for (int b = 0; b < npar; b++) s += g[a] * r->CovMatrix(a, b) * g[b];
         sigma.push_back(std::sqrt(s > 0 ? s : 0));
      }
      out << ",\"band\":{\"x\":"; put_array(bandX);
      out << ",\"sigma\":"; put_array(sigma); out << "}";
   }
   out << "}";
}

static TFitResultPtr fit_graph(const std::vector<double> &x, const std::vector<double> &y, const Spec &s, const std::vector<double> &bandX = {})
{
   TF1 f("f", formula_of(s.kind), x.front() - 1, x.back() + 1);
   for (size_t k = 0; k < s.start.size(); k++) f.SetParameter(k, s.start[k]);
   for (int k : s.fixed) f.FixParameter(k, s.start[k]);
   for (auto &l : s.limits) f.SetParLimits((int)l[0], l[1], l[2]);
   TGraph g(x.size(), x.data(), y.data());
   TFitResultPtr r = fit_twice(g, f, "0QS");
   write_fit(r, f, y, true, bandX, x);
   return r;
}

// The Gaussian size of a projection from the start of aa/image.js: the amplitude the range of the projection, the centre the first
// position of its maximum, the width one sixth of the number of positions, the offset its minimum.
static void fit_projection(const std::vector<double> &positions, const std::vector<double> &projection)
{
   size_t top = 0;
   double high = projection[0], low = projection[0];
   for (size_t i = 1; i < projection.size(); i++) {
      if (projection[i] > high) { high = projection[i]; top = i; }
      if (projection[i] < low) low = projection[i];
   }
   Spec s = {"gaussian", {high - low, positions[top], positions.size() / 6.0, low}, {}, {}};
   out << "{\"start\":"; put_array(s.start);
   out << ",\"fit\":";
   TFitResultPtr r = fit_graph(positions, projection, s);
   const double sigma = std::fabs(r->Parameter(2));
   out << ",\"sigma\":" << sigma << ",\"fwhm\":" << 2 * std::sqrt(2 * std::log(2.0)) * sigma << "}";
}

static void case_graph(const char *name, const std::vector<double> &x, const std::vector<double> &y, const std::vector<double> &truth, const Spec &s,
                       const std::vector<double> &bandX = {}, const char *extra = nullptr)
{
   out << "\"" << name << "\":{\"x\":"; put_array(x);
   out << ",\"y\":"; put_array(y);
   out << ",\"truth\":"; put_array(truth);
   out << ",\"start\":"; put_array(s.start);
   out << ",\"fit\":"; fit_graph(x, y, s, bandX);
   if (extra) out << extra;
   out << "}";
}

void root_fits(const char *path)
{
   fileBuffer.open(path, std::ios::out);
   out.rdbuf(&fileBuffer);
   out.precision(17);
   gRandom->SetSeed(20261111);
   TRandom3 rng(20261111);
   const std::vector<double> bandX = {0.0, 5.0, 10.0, 15.0, 20.0};
   auto x60 = grid(0.5, 10.0, 60);
   std::vector<double> lineY, polyY, expY, powY, logY;
   for (double x : x60) {
      lineY.push_back(-1.0 + 2.5 * x + rng.Gaus(0, 0.4));
      polyY.push_back(1.0 - 0.8 * x + 0.3 * x * x + rng.Gaus(0, 0.5));
      expY.push_back(3.0 * std::exp(0.25 * x) * std::exp(rng.Gaus(0, 0.05)));
      powY.push_back(2.0 * std::pow(x, 1.5) * std::exp(rng.Gaus(0, 0.05)));
      logY.push_back(1.5 + 2.0 * std::log(x) + rng.Gaus(0, 0.2));
   }
   auto sineX = grid(0, 20, 200), gaussX = grid(-5, 15, 200), landauX = grid(-5, 25, 300);
   std::vector<double> sineY, gaussY, landauY;
   for (double x : sineX) sineY.push_back(2.0 * std::sin(2 * TMath::Pi() * 0.15 * x + 0.7) + 1.0 + rng.Gaus(0, 0.15));
   for (double x : gaussX) gaussY.push_back(4.0 * std::exp(-0.5 * std::pow((x - 5.0) / 1.5, 2)) + 0.5 + rng.Gaus(0, 0.1));
   for (double x : landauX) landauY.push_back(30.0 * TMath::Landau(x, 4.0, 1.2, true) + 0.2 + rng.Gaus(0, 0.05));

   out << "{\"root\":\"" << gROOT->GetVersion() << "\",\"fitCases\":{";
   case_graph("line", x60, lineY, {-1.0, 2.5}, {"line", {0, 0}, {}, {}}, bandX); out << ",";
   // The inverse regression: x fitted on y, as the Correlation tab does for the other direction.
   case_graph("lineInverse", lineY, x60, {}, {"line", {0, 0}, {}, {}}); out << ",";
   case_graph("polynomial2", x60, polyY, {1.0, -0.8, 0.3}, {"polynomial2", {0, 0, 0}, {}, {}}); out << ",";
   case_graph("exponential", x60, expY, {3.0, 0.25}, {"exponential", {3.0, 0.25}, {}, {}}); out << ",";
   case_graph("power", x60, powY, {2.0, 1.5}, {"power", {2.0, 1.5}, {}, {}}); out << ",";
   case_graph("logarithm", x60, logY, {1.5, 2.0}, {"logarithm", {0, 0}, {}, {}}); out << ",";
   {
      Spec free = {"sine", {1.5, 0.14, 0.5, 0.8}, {}, {}};
      Spec fixed = {"sine", {1.5, 0.14, 0.5, 1.0}, {3}, {}};
      std::ostringstream extra;
      extra << ",\"fixedOffset\":";
      std::streambuf *keep = out.rdbuf();
      std::ostringstream buffer;
      buffer.precision(17);
      out.rdbuf(buffer.rdbuf());
      fit_graph(sineX, sineY, fixed);
      out.rdbuf(keep);
      extra << buffer.str();
      case_graph("sine", sineX, sineY, {2.0, 0.15, 0.7, 1.0}, free, bandX, extra.str().c_str());
   }
   out << ",";
   {
      Spec free = {"gaussian", {3.0, 4.5, 2.0, 0.0}, {}, {}};
      Spec bounded = {"gaussian", {3.0, 4.5, 2.0, 0.0}, {}, {{2, 1.8, 3.0}}};
      std::streambuf *keep = out.rdbuf();
      std::ostringstream buffer;
      buffer.precision(17);
      out.rdbuf(buffer.rdbuf());
      fit_graph(gaussX, gaussY, bounded);
      out.rdbuf(keep);
      std::string extra = ",\"boundedWidth\":" + buffer.str() + ",\"bounds\":{\"index\":2,\"low\":1.8,\"high\":3.0}";
      case_graph("gaussian", gaussX, gaussY, {4.0, 5.0, 1.5, 0.5}, free, {}, extra.c_str());
   }
   out << ",";
   {
      Spec s = {"landau", {25.0, 3.5, 1.0, 0.0}, {}, {}};
      auto v = grid(-4, 30, 69);
      std::vector<double> d;
      for (double t : v) d.push_back(TMath::Landau(t, 0.0, 1.0, true));
      std::ostringstream density;
      density.precision(17);
      std::streambuf *keep = out.rdbuf();
      out.rdbuf(density.rdbuf());
      out << ",\"density\":{\"v\":"; put_array(v);
      out << ",\"value\":"; put_array(d); out << "}";
      out.rdbuf(keep);
      case_graph("landau", landauX, landauY, {30.0, 4.0, 1.2, 0.2}, s, {}, density.str().c_str());
   }
   out << "},\"weightedFitCases\":{\"histogram\":";
   {
      TH1D h("h", "", 30, 2.0, 18.0);
      for (int i = 0; i < 5000; i++) h.Fill(rng.Gaus(10.0, 2.0));
      std::vector<double> low, high, counts, edges;
      int included = 0;
      for (int i = 1; i <= 30; i++) {
         low.push_back(h.GetBinLowEdge(i));
         high.push_back(h.GetBinLowEdge(i) + h.GetBinWidth(i));
         counts.push_back(h.GetBinContent(i));
         h.SetBinError(i, std::sqrt(h.GetBinContent(i)));
         if (h.GetBinContent(i) > 0) included++;
      }
      TF1 f("f", formula_of("gaussian"), 2.0, 18.0);
      std::vector<double> start = {h.GetMaximum(), 10.5, 1.5, 0.0};
      for (int k = 0; k < 4; k++) f.SetParameter(k, start[k]);
      TFitResultPtr r = fit_twice(h, f, "I0QS");
      out << "{\"low\":"; put_array(low);
      out << ",\"high\":"; put_array(high);
      out << ",\"counts\":"; put_array(counts);
      out << ",\"start\":"; put_array(start);
      out << ",\"included\":" << included << ",\"fit\":";
      write_fit(r, f, counts, false, {}, {});
      out << "}";
   }
   out << "},\"imageCases\":{";
   {
      const int width = 64, height = 48;
      std::vector<double> pixels(width * height);
      for (int y = 0; y < height; y++)
         for (int x = 0; x < width; x++)
            pixels[y * width + x] = std::round(1000 + 20000 * std::exp(-0.5 * (std::pow((x - 30.4) / 5.0, 2) + std::pow((y - 22.6) / 3.0, 2))) + rng.Gaus(0, 20));
      out << "\"width\":" << width << ",\"height\":" << height << ",\"pixels\":"; put_array(pixels);
      out << ",\"truth\":{\"x\":[30.4,5.0],\"y\":[22.6,3.0]},\"regions\":[";
      const int regions[3][4] = {{0, width, 0, height}, {8, 56, 6, 42}, {20, 41, 14, 32}};
      for (int k = 0; k < 3; k++) {
         const int x0 = regions[k][0], x1 = regions[k][1], y0 = regions[k][2], y1 = regions[k][3];
         std::vector<double> xs, ys, columns(x1 - x0, 0.0), rows(y1 - y0, 0.0);
         for (int x = x0; x < x1; x++) xs.push_back(x);
         for (int y = y0; y < y1; y++) ys.push_back(y);
         for (int y = y0; y < y1; y++)
            for (int x = x0; x < x1; x++) {
               columns[x - x0] += pixels[y * width + x];
               rows[y - y0] += pixels[y * width + x];
            }
         out << (k ? "," : "") << "{\"x0\":" << x0 << ",\"x1\":" << x1 << ",\"y0\":" << y0 << ",\"y1\":" << y1 << ",\"fitX\":";
         fit_projection(xs, columns);
         out << ",\"fitY\":";
         fit_projection(ys, rows);
         out << "}";
      }
      out << "]";
   }
   out << "}}\n";
   out.flush();
   fileBuffer.close();
}
