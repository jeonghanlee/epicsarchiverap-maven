# Glossary

The terms the console and this manual use, each defined once. The
information cards of the console explain a term where it first appears in
a card; this page holds the same definitions for the manual.

| Term | Definition |
| :--- | :--- |
| Admission | The check of the retrieval application that refuses a new request while the memory after garbage collection is above 50 percent of the maximum heap; the answer is HTTP 503. See [Limits on a request](retrieval.md#limits-on-a-request). |
| Analyzer | The data viewer of the retrieval web application, which charts PVs over a time window; the Analyzer menu entry of the console and the **Open in the analyzer** link open it. |
| Appliance | One installation of the archiver: the four processes management, engine, ETL (extract, transform, load) and retrieval, with their stores. This project runs one appliance per installation. |
| Block | In the treemap of the Operations page, a PV name prefix, the part of the name up to its second colon; the blocks inside it are its PVs. |
| BPL | Business process layer: the HTTP calls of the management web application, at `/mgmt/bpl/<call>`. See [Scripting](scripting.md). |
| Budget | The largest size a single request may declare to the retrieval application, 20 percent of the maximum heap by default. A request that declares more is refused with HTTP 400. |
| CA | Channel Access: the EPICS protocol over which the engine reads PVs from an IOC. |
| Capacity plan | A scheduled task of the management that reads, from every appliance, the sums of the sample and storage rates measured at the archive requests of its PVs. |
| Cluster | The word of the software for several appliances that work together, as in the `cluster_inetport` setting of `appliances.xml`. This project does not support running several appliances as a cluster. |
| Console | The web interface of the appliance, served by the management process; its pages are listed under [Pages](interface.md#pages). |
| Deadline | The duration limit of an HTTP retrieval request, measured from servlet entry; 900 seconds by default. A request that runs past it is stopped. |
| Declared size | The memory that a post-processor such as `mean` or `firstFill` needs for its bins or points, computed before the request reads data: the number of bins or points times a byte count for each. A raw read declares none. |
| Dropped sample | A sample the engine received and then discarded: its time stamp was wrong, the sample buffer of the PV was full, or the type of the PV had changed. The server counts it as `eventsDropped`. |
| Engine | The process that connects to the IOCs over Channel Access or PVAccess, receives the values of the archived PVs and writes them to the short term store. |
| ETL | The process that moves data from one store to the next at a fixed interval: from the short term store to the medium term store, and from there to the long term store. Each move is a pass. |
| Event | The word of the server for a sample, in field names such as `eventsDropped` and in the Details window. |
| Heap | The memory a process holds, in percent of its maximum. It rises and falls all the time; that is garbage collection. |
| Heap floor | The lowest point of the heap after a collection, drawn as the strong line of a heap chart. A floor that climbs from day to day means the heap is too small or something leaks. |
| Held | The state of an archive request whose name no server answered within the hold time of the appliance: the engine stopped searching, and the request waits for the operator to resume or cancel it. |
| Information card | The explanation of an item of a console page, opened by the **i** button beside it; its form is in [Information cards](interface.md#information-cards). |
| IOC | Input Output Controller: the EPICS server that holds the records whose values the PVs are. |
| LTS | Long term store: the last of the three stores. ETL moves data into it from the MTS. |
| Management | The process that holds the settings of the PVs, answers the console and the BPL calls, and opens the `cluster_inetport` endpoint that the other processes of the appliance connect to. |
| Metadata channel | A channel that the engine opens to read an extra field archived with a PV. The engine starts the metadata channels of a PV after the channel of its value has connected, a few PVs at a time; see [Configuration](configuration.md#archapplproperties). |
| mgmt | The name of the management web application in addresses, folders and logs, for example `/mgmt/bpl`. See Management. |
| Move | The transfer of data from one store to the next: from the short term store to the medium term store, or from the medium term store to the long term store. The ETL runs each move as passes at a fixed interval. |
| MTS | Medium term store: the second of the three stores. ETL moves data into it from the STS and out of it into the LTS. |
| Old generation | The part of the Java heap that holds long-lived objects. The retrieval application reads its usage after the last garbage collection to decide admission and pressure. |
| Partition | The file that holds the data of one PV for one period of a store, such as an hour, a day, a month or a year; the period is set per store. A pass moves whole partitions. |
| Pass | One run of a move over all its PVs, one job per PV. Its busy time is the time spent inside the jobs; a pass should end within the interval of its move. |
| Policy | The rule of the site that decides how a PV is sampled and in which stores its data is kept, chosen at the archive request by the measured event rate, by the name of the PV together with its storage rate, or by the operator. |
| Pressure | The state of the retrieval application while the memory after garbage collection is above 60 percent of the maximum heap. A running request that has allocated more than 1 percent of the heap is then stopped with HTTP 503. |
| PV | Process variable: one named value of the control system, for example a beam current, read from a record of an IOC. A name with a field (`X:Y.RBV`) is a PV of its own. |
| PVA | PVAccess: the EPICS protocol over which the engine reads PVs, including structured data, from an IOC. |
| Retrieval | The process that answers requests for stored data, from the console, the analyzer or a script. |
| Sample | One reading of a PV: its value, with the time stamp and the alarm severity the IOC gave it. |
| Sample buffer | The memory in which the engine holds the samples of one PV between two writes. Its size follows the write period, the sampling period of the PV and a margin of `sampleBufferMarginSeconds`; a record that posts faster overflows it. |
| Stores | The short term store, the medium term store and the long term store: the three places data lives as it ages, each with its own granularity and disk. |
| STS | Short term store: the first of the three stores. The engine writes the sample buffers to it once per write period. |
| Valve | A Tomcat component on the request path of a web application. The retrieval and management web applications declare a semaphore valve that answers HTTP 503 above a concurrency limit and a stuck-thread valve that interrupts a request that runs too long. See [Installing](installing.md#environment). |
| Write period | The interval at which the engine writes the sample buffers to the short term store. The writing must take less than the period, or samples are lost. |
