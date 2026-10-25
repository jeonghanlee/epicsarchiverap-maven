package org.epics.archiverappliance.config;

import org.junit.jupiter.api.Assertions;
import org.junit.jupiter.api.Test;

public class PVNameToKeyConverterTest {

	@Test
	public void testKeyName() throws Exception {
		DefaultConfigService configService = new ConfigServiceForTests(-1);
        String expectedKeyName = "A/B/C/D:";
        String keyName = configService.getPVNameToKeyConverter().convertPVNameToKey("A:B:C-D");
		Assertions.assertEquals(expectedKeyName, keyName, "We were expecting " + expectedKeyName + " instead we got " + keyName);
	}

	@Test
	public void testContainsSiteSeparators() throws Exception {
		DefaultConfigService configService = new ConfigServiceForTests(-1);
		PVNameToKeyMapping converter = configService.getPVNameToKeyConverter();
		// A multi-character PV name that contains a separator must be recognized as containing one.
		Assertions.assertTrue(converter.containsSiteSeparators("ArchUnitTest:fieldtst"), "':' is a site separator");
		Assertions.assertTrue(converter.containsSiteSeparators("ABC-DEF"), "'-' is a site separator");
		Assertions.assertTrue(converter.containsSiteSeparators(":"), "a lone separator is a separator");
		// A name with no separator at all must not be recognized as containing one.
		Assertions.assertFalse(converter.containsSiteSeparators("plainname"), "no separator present");
	}

}
