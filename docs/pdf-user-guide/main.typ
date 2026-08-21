// Markdown adapter entry.
// Prepared projects receive report-theme.typ beside this file.

#import "@preview/cmarker:0.1.10"
#import "@preview/mitex:0.2.7": mitex
#import "@preview/glossarium:0.5.10": make-glossary, register-glossary, print-glossary
#import "report-theme.typ": report-theme

#let markdown-source = "source.md"

#let glossary-entries = (
  (
    key: "foreground-service",
    short: "Foreground service",
    description: "Android-visible long-running host work with a persistent system notification.",
  ),
  (
    key: "owner-chat",
    short: "Owner chat",
    description: "The one configured private Telegram identity permitted to submit remote work.",
  ),
  (
    key: "host-policy",
    short: "Host policy",
    description: "Saved CPU, RAM, storage, battery, notification, and restart guardrails for Pocket Relay itself.",
  ),
  (
    key: "remote-mcp",
    short: "Remote MCP",
    long: "Remote Model Context Protocol connector",
    description: "An explicitly owner-approved public HTTPS Streamable HTTP tool endpoint.",
  ),
  (
    key: "skill",
    short: "Skill",
    description: "A capability-free QuickJS package that transforms JSON inside a non-exported isolated process.",
  ),
  (
    key: "backup",
    short: "Encrypted backup",
    description: "A password-protected, versioned export of a strict non-secret configuration allow-list.",
  ),
)

#show: make-glossary
#register-glossary(glossary-entries)

#show: report-theme.with(
  first-line-indent: none,
  running-header: false,
)

// cmarker emits tables with all-auto column widths. Re-emit those tables as
// full-width, booktabs-style tables while leaving explicitly sized tables alone.
#show table: it => {
  if it.columns.len() > 0 and it.columns.all(column => column == auto) {
    table(
      columns: (1fr,) * it.columns.len(),
      align: it.align,
      stroke: none,
      inset: (x: 10pt, y: 7pt),
      fill: (_, y) => if y > 0 and calc.even(y) { luma(248) } else { none },
      table.hline(stroke: 1pt),
      ..it.children.filter(
        child => child.func() != table.hline and child.func() != table.vline,
      ),
      table.hline(stroke: 1pt),
    )
  } else {
    it
  }
}
#show table.cell.where(y: 0): set text(weight: "bold")

// mitex renders LaTeX equations found in the Markdown source.
#align(center)[
  #v(1.1fr)
  #image("assets/pocket-relay-icon.png", width: 92pt)
  #v(18pt)
  #text(size: 28pt, weight: "bold")[Pocket Relay]
  #v(8pt)
  #text(size: 16pt)[Owner-operated Android agent host]
  #v(18pt)
  #text(size: 11pt, fill: luma(88))[User Guide · Version 1.0.0]
  #v(8pt)
  #text(size: 10pt, fill: luma(98))[GPL-3.0-only · Repository documentation]
  #v(1.2fr)
]

#pagebreak()
#cmarker.render(read(markdown-source), math: mitex)

#pagebreak()
= Glossary
#print-glossary(glossary-entries, show-all: true, disable-back-references: true)
