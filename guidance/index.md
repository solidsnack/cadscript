# Guidance

## Source Code Formatting

Source code should be formatted using:

- spaces for indentation;
- using 4 space indents;
- with lines of 79 columns;
- with UNIX line separators.

### TS

1. TypeScript should be formatted without terminal semicolons.
2. Always apply the formatter -- `deno fmt`, `prettier`, &c -- after doing any
   coding and review the output for clarity.

### SQL

1. SQL should be formatted with "river formatting" (also known as "Joe Celko's
   Style" or "right-aligned keywords style").
2. SQL keywords (`JOIN`, `NULL`, `SELECT`, &c) shall be capitalized.
3. Type names, column names, table names, function names and variable names
   shall be `snake_style`.
4. Table aliases should be avoided unless absolutely necessary.

## Commit Messages

1. The first line should be no more than 50 characters.
   1. It should not end in a period.
   2. It should be a simple, textual sentence.
2. The first line should be followed by a blank line.
3. The commit message should not be more than 20 lines long. It is preferable
   if it is 10 or less.
4. The use of AI should be indicated by the conventional co-authorship line.
