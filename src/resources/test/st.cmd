#!/usr/bin/env softIocPVX
# The one soft IOC of the console checks. ioc-runner starts it from consolechart.conf of this folder; it serves Channel Access and PVAccess.
# The developer guide of the book, section "Run the test IOC of the console checks", gives the steps.
# softIocPVX (EPICS 7.0.10 with pvxs) has to be on PATH: a shell gets it from setEpicsEnv.bash of the EPICS installation, the IOC configuration
# of ioc-runner from its PATH line.
# The databases it loads: ConsoleChartPVs.db (all the records of the checks), then the four records that the checks of a record that changes replace.
# RECORD_CHANGE is empty for those four as scalar doubles and Types for the same names on other types (ConsoleChartPVsRecordChangeTypes.db).
# CAV2_TEMP_EGU, CAV2_TEMP_PREC, CAV2_TEMP_HOPR, CAV2_TEMP_LOPR, CAV2_TEMP_HIGH, CAV2_TEMP_LOW and the same for CAV2_POWER give the two SR:RF:CAV2 records
# another unit, precision, display limits and alarm limits; unset, they keep the values that ConsoleChartPVs.db holds.
dbLoadRecords("ConsoleChartPVs.db", "CAV2_TEMP_EGU=$(CAV2_TEMP_EGU=C),CAV2_TEMP_PREC=$(CAV2_TEMP_PREC=2),CAV2_TEMP_HOPR=$(CAV2_TEMP_HOPR=0),CAV2_TEMP_LOPR=$(CAV2_TEMP_LOPR=0),CAV2_TEMP_HIGH=$(CAV2_TEMP_HIGH=0),CAV2_TEMP_LOW=$(CAV2_TEMP_LOW=0),CAV2_POWER_EGU=$(CAV2_POWER_EGU=kW),CAV2_POWER_PREC=$(CAV2_POWER_PREC=1),CAV2_POWER_HOPR=$(CAV2_POWER_HOPR=0),CAV2_POWER_LOPR=$(CAV2_POWER_LOPR=0),CAV2_POWER_HIGH=$(CAV2_POWER_HIGH=0),CAV2_POWER_LOW=$(CAV2_POWER_LOW=0)")
dbLoadRecords("ConsoleChartPVsRecordChange$(RECORD_CHANGE=).db")
iocInit
