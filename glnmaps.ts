import { readCSVObjects } from "https://deno.land/x/csv/mod.ts";
import { serve } from "https://deno.land/std@0.159.0/http/server.ts";

serve(handler, { port: 3000 });
console.log('glnmaps is running. Access it at: http://localhost:3000/');
const csvPath = Deno.args[0];
const geojson = await csv2geojson(csvPath);
const index = await Deno.readTextFile("./index.html");
const html = index.replace("{{geojson}}", geojson);

async function csv2geojson(_csvPath: string) {
  const f = await Deno.open(_csvPath);
  let geojson;
  geojson = '{"type": "FeatureCollection","features": [{';

  let features = [];
  for await (const row of readCSVObjects(f)) {
    const lat = Number(row['緯度'] || row['緯度（10進法）']);
    const lng = Number(row['経度'] || row['経度（10進法）']);
    const data = {
      type: "Feature",
      geometry: {
        type: "Point",
        coordinates: [lng, lat],
      },
      properties: {
        title: row['名称'],
        description: row['名称'],
      }
    };
    features.push(data);
  }
  f.close();

  const json = {
    type: "FeatureCollection",
    features: features
  }
  return JSON.stringify(json);
}

async function handler(req: Request): Promise<Response> {
  const url = new URL(req.url);

  if (url.pathname == "/") {
    return new Response(html, {
      headers: { "content-type": "text/html" },
    });
  } else if (url.pathname == "/download") {
    return new Response(html, {
      headers: { "content-type": "text/plain" },
    });
  } else {
    return new Response("Not Found", { status: 404 });
  }
}
