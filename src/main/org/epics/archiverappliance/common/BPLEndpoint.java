package org.epics.archiverappliance.common;

import java.lang.annotation.Documented;
import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

/**
 * Describes a mgmt BPL action for the generated API reference. The path and
 * HTTP method come from the BPLServlet registry; this annotation supplies the
 * human-facing summary and the request parameters. An action without this
 * annotation still appears in the reference by path alone. The reference is
 * rendered at build time into the mgmt WAR under ui/api.
 */
@Documented
@Retention(RetentionPolicy.RUNTIME)
@Target(ElementType.TYPE)
public @interface BPLEndpoint {
    /** One-paragraph description of what the action does. */
    String summary();

    /** Request parameters the action accepts, in the order they should be documented. */
    BPLParam[] params() default {};
}
