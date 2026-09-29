#!/usr/bin/env python3
"""Request archiving resumes for a file of existing PV names."""

import sys

from archiverClient import pause_resume_main


if __name__ == "__main__":
    sys.exit(pause_resume_main(False))
