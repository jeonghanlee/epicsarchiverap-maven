# EPICS Archiver Appliance

The EPICS Archiver Appliance is an implementation of an archiver for
[EPICS](http://www.aps.anl.gov/epics/index.php) control systems that
aims to archive millions of PVs.

At a high level, some features are

- Ability to cluster appliances and to scale by adding appliances to
  the cluster.
- Multiple stages and an inbuilt process to move data between the
  stages.
- Focus on data retrieval performance.
- Focus on zero oversight.

For a more detailed description, please see the [Details](developer/details.md)
page.

To get started, please see the [Quickstart](sysadmin/quickstart.md) guide.

This project is part of the
[AccelUtils](http://accelutils.sourceforge.net/) collaboration.
