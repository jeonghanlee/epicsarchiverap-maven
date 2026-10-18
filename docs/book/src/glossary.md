# Glossary

The terms the console and this manual use, each defined once. The
information cards of the console explain a term where it first appears in
a card; this page holds the same definitions for the manual.

| Term | Definition |
| :--- | :--- |
| Appliance | One installation of the archiver: the four processes management, engine, ETL and retrieval, with their stores. A cluster has one or more appliances. |
| Block | In the treemap of the Operations page, a PV name prefix, the part of the name up to its second colon; the blocks inside it are its PVs. |
| Dropped sample | A sample the engine received and then discarded: its time stamp was wrong, the sample buffer of the PV was full, or the type of the PV had changed. The server counts it as `eventsDropped`. |
| Engine | The process that connects to the IOCs over Channel Access or PV Access, receives the values of the archived PVs and writes them to the short term store. |
| ETL | The process that moves data from one store to the next at a fixed interval: from the short term store to the medium term store, and from there to the long term store. Each move is a pass. |
| Event | The word of the server for a sample, in field names such as `eventsDropped` and in the Details window. |
| Heap | The memory a process holds, in percent of its maximum. It rises and falls all the time; that is garbage collection. |
| Heap floor | The lowest point of the heap after a collection, drawn as the strong line of a heap chart. A floor that climbs from day to day means the heap is too small or something leaks. |
| Information card | The explanation of an item of a console page, opened by the **i** button beside it; its form is in [Information cards](interface.md#information-cards). |
| IOC | Input Output Controller: the EPICS server that holds the records whose values the PVs are. |
| Management | The process that holds the settings of the PVs, answers the console and the BPL calls, and coordinates the appliances of a cluster. |
| Pass | One run of the ETL from a store to the next, for every PV of that move. |
| Policy | The rule of the site that decides how a PV is sampled and in which stores its data is kept, chosen by the name of the PV at the archive request. |
| PV | Process variable: one named value of the control system, for example a beam current, read from a record of an IOC. A name with a field (`X:Y.RBV`) is a PV of its own. |
| Retrieval | The process that answers requests for stored data, from the console, the analyzer or a script. |
| Sample | One reading of a PV: its value, with the time stamp and the alarm severity the IOC gave it. |
| Sample buffer | The memory in which the engine holds the samples of one PV between two writes. Its size follows the rate measured at the archive request; a record that posts faster overflows it. |
| Stores | The short term store, the medium term store and the long term store: the three places data lives as it ages, each with its own granularity and disk. |
| Write period | The interval at which the engine writes the sample buffers to the short term store. The writing must take less than the period, or samples are lost. |
