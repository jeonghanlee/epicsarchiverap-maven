package org.epics.archiverappliance.common;

import java.lang.annotation.Documented;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

/**
 * One request parameter of a mgmt BPL action, used inside {@link BPLEndpoint}.
 */
@Documented
@Retention(RetentionPolicy.RUNTIME)
@Target({})
public @interface BPLParam {
    /** The request parameter name as sent by the client. */
    String name();

    /** What the parameter means and any accepted forms or wildcards. */
    String description();
}
