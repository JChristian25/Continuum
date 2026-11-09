# Legacy prototype editing helpers

These three Python scripts are retained one-time source transformations from earlier prototype work. They are not build tools or database migrations and may assume source text that has already changed. Routine frontend development does not require running them.

The scripts now resolve their targets under `apps/web/src/` from their own file location. Only those path references were adjusted during the repository restructure; the transformations were not executed.
