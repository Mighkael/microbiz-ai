// Generates one small, pre-projected county map per state for the Sector
// Browser's map view: public/geo/counties/<stateFips>.json.
// Source: us-atlas (Census cartographic boundaries, public domain).
// Run: node scripts/generate-county-maps.mjs
//
// Split by state so opening a county map downloads one state's shapes rather
// than the 800 KB national file, and fitted per state so a small state fills
// the frame instead of sitting as a speck inside a national projection.
import { writeFileSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { geoConicEqualArea, geoPath } from "d3-geo";
import { feature } from "topojson-client";

const require = createRequire(import.meta.url);
const topo = require("us-atlas/counties-10m.json");

const WIDTH = 975;
const HEIGHT = 610;
const round = (d) => d.replace(/-?\d+\.\d+/g, (n) => String(Math.round(n * 10) / 10));

const counties = feature(topo, topo.objects.counties).features;
const states = feature(topo, topo.objects.states).features;

mkdirSync("public/geo/counties", { recursive: true });

let written = 0;
let bytes = 0;
for (const state of states) {
  const fips = String(state.id).padStart(2, "0");
  const members = counties.filter((c) => String(c.id).padStart(5, "0").startsWith(fips));
  if (members.length === 0) continue;

  const collection = { type: "FeatureCollection", features: members };
  // A conic equal-area projection centred on each state keeps its shape
  // honest. Alaska gets its own parallels and is rotated so the Aleutians
  // don't wrap across the antimeridian.
  const [[w, s], [e, n]] = geoPath().bounds(collection);
  const projection = fips === "02"
    ? geoConicEqualArea().parallels([55, 65]).rotate([154, 0]).center([0, 62])
    : geoConicEqualArea().parallels([s + (n - s) / 6, n - (n - s) / 6]).rotate([-(w + e) / 2, 0]).center([0, (s + n) / 2]);
  projection.fitExtent([[8, 8], [WIDTH - 8, HEIGHT - 8]], collection);
  const path = geoPath(projection);

  const out = {
    state: fips,
    stateName: state.properties?.name ?? "",
    width: WIDTH,
    height: HEIGHT,
    counties: members
      .map((c) => ({ id: String(c.id).padStart(5, "0"), name: c.properties?.name ?? "", d: path(c) }))
      .filter((c) => c.d)
      .map((c) => ({ ...c, d: round(c.d) })),
  };
  const json = JSON.stringify(out);
  writeFileSync(`public/geo/counties/${fips}.json`, json);
  written += 1;
  bytes += json.length;
}

console.log(`Wrote ${written} state files, ${(bytes / 1024).toFixed(0)} KB total.`);
