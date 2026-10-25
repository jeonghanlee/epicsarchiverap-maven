# Documentation for the EPICS Archiver Appliance

- `book/`: the manual, an mdBook that `.github/workflows/pages.yml` builds and publishes to GitHub Pages on every push to the `master` branch that changes it.
- `design-*.md`: design notes. `design-etl-pass-scheduler.md` describes the scheduler of the ETL passes (ETL moves data from one store to the next), which is implemented. `design-analyzer.md` describes the analyzer, which is planned.
- `milestone-daff1b7.md` and `CLOSED_DOORS.md`: the work register and the examined candidates left unchanged.
- `archiverap-carry-d12382d1.md`: the selection of upstream changes for adoption into this project.
- The protocol buffer schema of the stored samples is `src/main/edu/stanford/slac/archiverappliance/PB/EPICSEvent.proto`.
