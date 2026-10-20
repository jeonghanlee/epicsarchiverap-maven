package org.epics.archiverappliance.retrieval.postprocessors;

import java.util.LinkedList;
import java.util.Set;

import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;

/**
 * Factory class for post processors.
 * We use startsWith on the identity so we have to be careful when one post processor's identity is a substring of another. 
 * If possible, avoid
 * @author mshankar
 *
 */
public class PostProcessors {
	private static Logger logger = LogManager.getLogger(PostProcessors.class.getName());
	
	private enum InheritValuesFromPreviousBins {DO_NOT_INHERIT, INHERIT}
	private static class PostProcessorImplementation {
		
		public PostProcessorImplementation(String key, Class<? extends PostProcessor> clazz) {
			this.key = key;
			this.clazz = clazz;
		}

		public PostProcessorImplementation(String key, Class<? extends PostProcessor> clazz, InheritValuesFromPreviousBins inheritValuesFromPreviousBins) {
			this.key = key;
			this.clazz = clazz;
			this.inheritValuesFromPreviousBins = inheritValuesFromPreviousBins;
		}
		
		String key;
		Class<? extends PostProcessor> clazz;
		private InheritValuesFromPreviousBins inheritValuesFromPreviousBins = InheritValuesFromPreviousBins.INHERIT;
	}
	
	/**
	 * The names that mean raw data or that the server sends to other appliances for its own post processors; none of them has an argument or a registry entry.
	 */
	private static final Set<String> RAW_AND_INTERNAL_NAMES = Set.of(
			DefaultRawPostProcessor.PB_IDENTITY, TwoWeekRaw.TWOWEEK_IDENTITY, ExtraFieldsPostProcessor.EXTRA_FIELDS);

	private static LinkedList<PostProcessorImplementation> postprocessors = new LinkedList<PostProcessorImplementation>();
	
	private static void registerPostProcessor(String identity, Class<? extends PostProcessor> clazz) { 
		try {
			PostProcessor implementationInstance = clazz.getConstructor().newInstance();
			if(implementationInstance instanceof FillNoFillSupport) {
				logger.debug("Registering the no fill variant of post processor " + identity);
				postprocessors.add(new PostProcessorImplementation(identity + "Sample", clazz, InheritValuesFromPreviousBins.DO_NOT_INHERIT));
			}
		} catch (Exception e) {
			logger.error("Exception registering post processor " + identity, e);
		}
		
		// Now, register the actual post processor - in this case, the fill variant.
		postprocessors.add(new PostProcessorImplementation(identity, clazz));
	}
	
	static {
		// Order of insertion matters as we use startsWith; test when you add new post processors.
		registerPostProcessor(new FirstSamplePP().getIdentity(), FirstSamplePP.class);
		registerPostProcessor(new Mean().getIdentity(), Mean.class);
		registerPostProcessor(new Jitter().getIdentity(), Jitter.class);
		registerPostProcessor(new StandardDeviation().getIdentity(), StandardDeviation.class);
		registerPostProcessor(new IgnoreFliers().getIdentity(), IgnoreFliers.class);
		registerPostProcessor(new Fliers().getIdentity(), Fliers.class);
		registerPostProcessor(new LinearInterpolation().getIdentity(), LinearInterpolation.class);
		registerPostProcessor(new LoessInterpolation().getIdentity(), LoessInterpolation.class);
		registerPostProcessor(new Median().getIdentity(), Median.class);
		registerPostProcessor(new Variance().getIdentity(), Variance.class);
		registerPostProcessor(new PopulationVariance().getIdentity(), PopulationVariance.class);
		registerPostProcessor(new RMS().getIdentity(), RMS.class);
		registerPostProcessor(new Kurtosis().getIdentity(), Kurtosis.class);
		registerPostProcessor(new Skewness().getIdentity(), Skewness.class);
		registerPostProcessor(new FirstFill().getIdentity(), FirstFill.class);
		registerPostProcessor(new LastFill().getIdentity(), LastFill.class);
		registerPostProcessor(new LastSample().getIdentity(), LastSample.class);
		registerPostProcessor(new Max().getIdentity(), Max.class);
		registerPostProcessor(new Min().getIdentity(), Min.class);
		registerPostProcessor(new Count().getIdentity(), Count.class);
		registerPostProcessor(new NCount().getIdentity(), NCount.class);
		registerPostProcessor(new Nth().getIdentity(), Nth.class);
		registerPostProcessor(new Statistics().getIdentity(), Statistics.class);
		registerPostProcessor(new OptimizedWithLastSample().getIdentity(), OptimizedWithLastSample.class);
		registerPostProcessor(new Optimized().getIdentity(), Optimized.class);
		registerPostProcessor(new CAPlotBinning().getIdentity(), CAPlotBinning.class);
		registerPostProcessor(new DeadBand().getIdentity(), DeadBand.class);
		registerPostProcessor(new ErrorBars().getIdentity(), ErrorBars.class);
    

	}

	public static PostProcessor findPostProcessor(String postProcessorUserArg) {
		if(postProcessorUserArg != null && !postProcessorUserArg.trim().isEmpty()) {
			try {
				for(PostProcessorImplementation implementation : postprocessors) {
					if(postProcessorUserArg.startsWith(implementation.key)) {
						logger.debug("Found postprocessor for " + postProcessorUserArg);
						PostProcessor implementationInstance = implementation.clazz.getConstructor().newInstance();
						if(implementation.inheritValuesFromPreviousBins == InheritValuesFromPreviousBins.DO_NOT_INHERIT 
								&& implementationInstance instanceof FillNoFillSupport) { 
							logger.debug("Turning off inheriting values from previous bins for empty bins");
							((FillNoFillSupport)implementationInstance).doNotInheritValuesFromPrevioisBins();
						}
						return implementationInstance;
					}
				}
				logger.error("Did not find post processor for '" + postProcessorUserArg + "'");
			} catch(Exception ex) {
				logger.error("Exception initializing processor", ex);
			}
		}
		return null;
	}

	/**
	 * Checks the retrieval operator string of a request, for example mean_60, before any data is read.
	 * A missing or blank string and the names that the server itself sends to other appliances are accepted.
	 * Otherwise the name before the first underscore must be a registered key and the argument must parse and lie in the domain of the operator.
	 * This is stricter than {@link #findPostProcessor(String)}, which matches on the start of the string.
	 * @param postProcessorUserArg The operator string, for example mean_60 or flyers_60_3.5.
	 * @return null if the string is acceptable, else a message that names the operator and the reason.
	 */
	public static String checkPostProcessorUserArg(String postProcessorUserArg) {
		if(postProcessorUserArg == null || postProcessorUserArg.trim().isEmpty()) {
			return null;
		}
		if(RAW_AND_INTERNAL_NAMES.contains(postProcessorUserArg)) {
			return null;
		}
		int firstUnderscore = postProcessorUserArg.indexOf('_');
		String name = firstUnderscore < 0 ? postProcessorUserArg : postProcessorUserArg.substring(0, firstUnderscore);
		Class<? extends PostProcessor> clazz = null;
		for(PostProcessorImplementation implementation : postprocessors) {
			if(implementation.key.equals(name)) {
				clazz = implementation.clazz;
				break;
			}
		}
		if(clazz == null) {
			return "The retrieval operator \"" + postProcessorUserArg + "\" is not known.";
		}
		if(firstUnderscore < 0) {
			return null;
		}
		String argument = postProcessorUserArg.substring(firstUnderscore + 1);
		String problem = describeArgumentProblem(clazz, argument);
		if(problem == null) {
			return null;
		}
		return "The retrieval operator \"" + postProcessorUserArg + "\" has a bad argument \"" + argument + "\": " + problem + ".";
	}

	private static String describeArgumentProblem(Class<? extends PostProcessor> clazz, String argument) {
		if(NCount.class.isAssignableFrom(clazz)) {
			return "the operator takes no argument";
		}
		String[] segments = argument.split("_", -1);
		if(DeadBand.class.isAssignableFrom(clazz)) {
			if(segments.length != 1) {
				return "expected one number of at least 0";
			}
			try {
				double value = Double.parseDouble(segments[0]);
				if(Double.isNaN(value) || Double.isInfinite(value) || value < 0) {
					return "expected a finite number of at least 0";
				}
			} catch(NumberFormatException ex) {
				return "expected a finite number of at least 0";
			}
			return null;
		}
		boolean hasDeviations = Fliers.class.isAssignableFrom(clazz) || IgnoreFliers.class.isAssignableFrom(clazz);
		if(segments.length > (hasDeviations ? 2 : 1)) {
			return hasDeviations ? "expected an integer of at least 1 and optionally a number above 0" : "expected one integer of at least 1";
		}
		try {
			if(Integer.parseInt(segments[0]) < 1) {
				return "expected an integer of at least 1";
			}
		} catch(NumberFormatException ex) {
			return "expected an integer of at least 1";
		}
		if(segments.length == 2) {
			try {
				float numDeviations = Float.parseFloat(segments[1]);
				if(Float.isNaN(numDeviations) || Float.isInfinite(numDeviations) || numDeviations <= 0) {
					return "the second argument must be a finite number above 0";
				}
			} catch(NumberFormatException ex) {
				return "the second argument must be a finite number above 0";
			}
		}
		return null;
	}

	public static final int DEFAULT_SUMMARIZING_INTERVAL = 15*60;
}
