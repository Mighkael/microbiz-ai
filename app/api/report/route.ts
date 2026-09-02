// app/api/report/route.ts
// POST /api/report  -> a .docx download
//
// Standardised report export (§17). Word rather than PDF because a .docx can
// be edited — an owner taking this to a lender or landlord usually needs to
// add to it. PDF is covered by the print view, which uses the same content.

import { NextRequest, NextResponse } from "next/server";
import {
  Document, Packer, Paragraph, TextRun, HeadingLevel,
  Table, TableRow, TableCell, WidthType, ShadingType, AlignmentType, BorderStyle,
} from "docx";

export const maxDuration = 30;

/** US Letter in DXA (twentieths of a point); docx defaults to A4. */
const LETTER = { width: 12240, height: 15840 };
const CONTENT_WIDTH = 9360; // 6.5in between 1in margins

type ReportSection = {
  heading: string;
  paragraphs?: string[];
  table?: { columns: string[]; rows: string[][] };
};

type ReportPayload = {
  title: string;
  subtitle?: string;
  sections: ReportSection[];
  sources?: string[];
  limitations?: string;
};

const INK = "16242E";
const LEDGER = "0E7B5F";
const MIST = "64798A";
const RULE = "DFE6E4";

function buildTable(columns: string[], rows: string[][]) {
  // Column widths must sum to the table width, and every cell needs its own
  // width in DXA — percentage widths break in Google Docs.
  const colWidth = Math.floor(CONTENT_WIDTH / columns.length);
  const widths = columns.map(() => colWidth);

  const cell = (text: string, opts: { header?: boolean } = {}) =>
    new TableCell({
      width: { size: colWidth, type: WidthType.DXA },
      shading: opts.header
        ? { type: ShadingType.CLEAR, color: "auto", fill: "F0F3F2" }
        : undefined,
      margins: { top: 80, bottom: 80, left: 120, right: 120 },
      children: [
        new Paragraph({
          children: [new TextRun({ text, bold: opts.header, size: 20, color: opts.header ? INK : "333333" })],
        }),
      ],
    });

  return new Table({
    columnWidths: widths,
    width: { size: CONTENT_WIDTH, type: WidthType.DXA },
    rows: [
      new TableRow({ tableHeader: true, children: columns.map((c) => cell(c, { header: true })) }),
      ...rows.map((r) => new TableRow({ children: r.map((v) => cell(v)) })),
    ],
  });
}

function buildDocument(payload: ReportPayload): Document {
  const children: (Paragraph | Table)[] = [];

  children.push(
    new Paragraph({
      children: [new TextRun({ text: payload.title, bold: true, size: 44, color: INK })],
      spacing: { after: 100 },
    }),
  );

  if (payload.subtitle) {
    children.push(
      new Paragraph({
        children: [new TextRun({ text: payload.subtitle, size: 22, color: MIST })],
        spacing: { after: 120 },
      }),
    );
  }

  children.push(
    new Paragraph({
      children: [new TextRun({
        text: `Generated ${new Date().toLocaleDateString("en-US", { dateStyle: "long" })} · MicroBiz AI`,
        size: 18, color: MIST,
      })],
      // A rule rather than a table — a one-row table as a divider is a
      // classic docx mistake that renders badly.
      border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: RULE, space: 8 } },
      spacing: { after: 320 },
    }),
  );

  for (const section of payload.sections) {
    children.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        children: [new TextRun({ text: section.heading, bold: true, size: 26, color: LEDGER })],
        spacing: { before: 280, after: 120 },
      }),
    );

    for (const text of section.paragraphs ?? []) {
      children.push(
        new Paragraph({
          children: [new TextRun({ text, size: 21, color: "333333" })],
          spacing: { after: 120 },
        }),
      );
    }

    if (section.table) {
      children.push(buildTable(section.table.columns, section.table.rows));
      children.push(new Paragraph({ text: "", spacing: { after: 120 } }));
    }
  }

  if (payload.sources?.length) {
    children.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        children: [new TextRun({ text: "Data sources", bold: true, size: 26, color: LEDGER })],
        spacing: { before: 280, after: 120 },
      }),
    );
    for (const s of payload.sources) {
      children.push(
        new Paragraph({
          children: [new TextRun({ text: s, size: 19, color: MIST })],
          bullet: { level: 0 },
          spacing: { after: 60 },
        }),
      );
    }
  }

  children.push(
    new Paragraph({
      children: [new TextRun({
        text: payload.limitations
          ?? "Figures shown are modelled from the assumptions provided and from published data where cited. This is an educational tool, not financial, legal, tax, or investment advice, and is not a prediction of results.",
        size: 17, color: MIST, italics: true,
      })],
      spacing: { before: 360 },
      alignment: AlignmentType.LEFT,
    }),
  );

  return new Document({
    sections: [{
      properties: { page: { size: LETTER } },
      children,
    }],
  });
}

export async function POST(req: NextRequest) {
  try {
    const payload = (await req.json()) as ReportPayload;
    if (!payload?.title || !Array.isArray(payload.sections)) {
      return NextResponse.json({ error: "A report title and sections are required." }, { status: 400 });
    }

    const buffer = await Packer.toBuffer(buildDocument(payload));
    const filename = `${payload.title.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase()}.docx`;

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (err) {
    console.error("Report generation failed:", err);
    return NextResponse.json({ error: "Couldn't build the document. Please try again." }, { status: 500 });
  }
}
