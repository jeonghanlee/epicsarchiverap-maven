/*******************************************************************************
 * Copyright (c) 2011 The Board of Trustees of the Leland Stanford Junior University
 * as Operator of the SLAC National Accelerator Laboratory.
 * Copyright (c) 2011 Brookhaven National Laboratory.
 * EPICS archiver appliance is distributed subject to a Software License Agreement found
 * in file LICENSE that is included with this distribution.
 *******************************************************************************/
package org.epics.archiverappliance.retrieval.pva;

import com.google.common.primitives.Bytes;
import com.google.common.primitives.Doubles;
import com.google.common.primitives.Floats;
import com.google.common.primitives.Ints;
import com.google.common.primitives.Shorts;
import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;
import org.epics.archiverappliance.Event;
import org.epics.archiverappliance.EventStream;
import org.epics.archiverappliance.EventStreamDesc;
import org.epics.archiverappliance.common.BasicContext;
import org.epics.archiverappliance.config.ArchDBRTypes;
import org.epics.archiverappliance.data.DBRTimeEvent;
import org.epics.archiverappliance.retrieval.RemotableEventStreamDesc;
import org.epics.archiverappliance.retrieval.mimeresponses.MimeResponse;
import org.epics.pva.data.ElementTypeException;
import org.epics.pva.data.PVAAnyArray;
import org.epics.pva.data.PVAInt;
import org.epics.pva.data.PVAString;
import org.epics.pva.data.PVAStringArray;
import org.epics.pva.data.PVAStructure;
import org.epics.pva.data.PVAStructureArray;
import org.epics.pva.data.PVAny;
import org.epics.pva.data.nt.PVAAlarm;
import org.epics.pva.data.nt.PVAEnum;
import org.epics.pva.data.nt.PVAScalar;
import org.epics.pva.data.nt.PVATimeStamp;

import java.io.OutputStream;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashMap;
import java.util.List;

/**
 * The response is an array of PV elements, each PV has a meta and data section. The data section has timestamp in epoch
 * seconds and the value
 *
 * @author mshankar
 */
public class PvaMimeResponse implements MimeResponse {
    private static final Logger logger = LogManager.getLogger(PvaMimeResponse.class.getName());

    boolean firstPV = true;
    boolean closePV = false;

    private ArchDBRTypes streamDBRType;
    private PVAStructure resultStruct;
    private final List<String> labels = new ArrayList<>();
    private final List<PVAny> values = new ArrayList<>();
    private final List<PVAStructure> samples = new ArrayList<>();
    private PVAStructure elementType;

    @SuppressWarnings("unchecked")
    @Override
    public void consumeEvent(Event e) throws Exception {

        DBRTimeEvent evnt = (DBRTimeEvent) e;

        logger.debug("The event stream type is: " + evnt.getDBRType());

        PVAScalar.Builder builder;

        switch (streamDBRType) {
            case DBR_SCALAR_FLOAT -> builder = PVAScalar.floatScalarBuilder(evnt.getSampleValue().getValue().floatValue());
            case DBR_SCALAR_DOUBLE -> builder = PVAScalar.doubleScalarBuilder(evnt.getSampleValue().getValue().doubleValue());
            case DBR_SCALAR_BYTE -> builder = PVAScalar.byteScalarBuilder(false, evnt.getSampleValue().getValue().byteValue());
            case DBR_SCALAR_SHORT -> builder = PVAScalar.shortScalarBuilder(false, evnt.getSampleValue().getValue().shortValue());
            case DBR_SCALAR_INT -> builder = PVAScalar.intScalarBuilder(evnt.getSampleValue().getValue().intValue());
            case DBR_SCALAR_STRING -> builder = PVAScalar.stringScalarBuilder(evnt.getSampleValue().toString());
            case DBR_SCALAR_ENUM -> {
                PVAEnum pvaEnum = new PVAEnum("value", evnt.getSampleValue().getValue().intValue(), new String[]{});
                builder = (new PVAScalar.Builder<PVAEnum>()).value(pvaEnum);
            }
            case DBR_WAVEFORM_FLOAT -> {
                List<Float> values = evnt.getSampleValue().getValues();
                builder = PVAScalar.floatArrayScalarBuilder(Floats.toArray(values));
            }
            case DBR_WAVEFORM_DOUBLE -> {
                List<Double> values = evnt.getSampleValue().getValues();
                builder = PVAScalar.doubleArrayScalarBuilder(Doubles.toArray(values));
            }
            case DBR_WAVEFORM_SHORT -> {
                List<Short> values = evnt.getSampleValue().getValues();
                builder = PVAScalar.shortArrayScalarBuilder(false, Shorts.toArray(values));
            }
            case DBR_WAVEFORM_BYTE -> {
                List<Byte> values = evnt.getSampleValue().getValues();
                builder = PVAScalar.byteArrayScalarBuilder(false, Bytes.toArray(values));
            }
            case DBR_WAVEFORM_INT -> {
                List<Integer> values = evnt.getSampleValue().getValues();
                builder = PVAScalar.intArrayScalarBuilder(false, Ints.toArray(values));
            }
            case DBR_WAVEFORM_STRING -> {
                List<String> values = evnt.getSampleValue().getValues();
                builder = PVAScalar.stringArrayScalarBuilder(values.toArray(new String[values.size()]));
            }
            case DBR_WAVEFORM_ENUM, DBR_V4_GENERIC_BYTES -> throw new UnsupportedOperationException("Unsupported DBR type " + streamDBRType);

            default -> throw new UnsupportedOperationException("Unknown DBR type " + streamDBRType);
        }

        PVAStructure s = builder.name("sample")
                .alarm(alarmInfo(evnt))
                .timeStamp(timeInfo(evnt))
                .build();
        if (elementType == null) {
            elementType = s.cloneType("element_type");
        } else if (!s.cloneType(elementType.getName()).equals(elementType)) {
            throw new ElementTypeException(s, elementType);
        }
        samples.add(s);
    }

    private PVAAlarm alarmInfo(DBRTimeEvent evnt) {
        // convert the alarm info
        return new PVAAlarm(new PVAInt("severity", evnt.getSeverity()),
                new PVAInt("status", evnt.getStatus()),
                new PVAString("message"));
    }

    private PVATimeStamp timeInfo(DBRTimeEvent evnt) {
        // convert the time info
        return new PVATimeStamp(evnt.getEventTimeStamp());
    }

    @Override
    public void setOutputStream(OutputStream os) {
        // TODO
    }

    @Override
	public void close() {
		finishPV();
        if (!labels.isEmpty()) {
            PVAStringArray resultLabels = resultStruct.get("labels");
            resultLabels.set(labels.toArray(String[]::new));
        }
        if (!values.isEmpty()) {
            PVAAnyArray resultValues = resultStruct.get("value");
            resultValues.set(values.toArray(PVAny[]::new));
        }
	}

	@Override
    public void processingPV(BasicContext retrievalContext, String pv, Instant start, Instant end, EventStreamDesc streamDesc) {
		finishPV();
		if (firstPV) {
			firstPV = false;
		}
		RemotableEventStreamDesc remoteDesc = (RemotableEventStreamDesc) streamDesc;
		this.streamDBRType = remoteDesc.getArchDBRType();

        labels.add(pv);
        values.add(new PVAny("any"));
		elementType = null;

		closePV = true;
	}

    private void finishPV() {
        if (samples.isEmpty()) return;
        // Every sample was type-checked on arrival; publish the complete array once.
        values.set(values.size() - 1, new PVAny("any",
                new PVAStructureArray("result", elementType, samples.toArray(PVAStructure[]::new))));
        samples.clear();
    }

	public void swicthingToStream(EventStream strm) {
		// Not much to do here for now.
	}

    public void setOutputStruct(PVAStructure resultStruct) {
        this.resultStruct = resultStruct;
        labels.clear();
        values.clear();
        samples.clear();
        elementType = null;
        PVAStringArray resultLabels = resultStruct.get("labels");
        labels.addAll(Arrays.asList(resultLabels.get()));
        PVAAnyArray resultValues = resultStruct.get("value");
        if (resultValues.get() != null) values.addAll(Arrays.asList(resultValues.get()));
    }

}
