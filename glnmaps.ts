import { readCSVObjects } from "https://deno.land/x/csv/mod.ts";
import { serve } from "https://deno.land/std@0.159.0/http/server.ts";
import * as Colors from "https://deno.land/std@0.146.0/fmt/colors.ts";
import { readLines } from 'https://deno.land/std/io/mod.ts'
import { readAll } from "https://deno.land/std@0.117.0/streams/conversion.ts";

const filePath = Deno.args[0];
let geojson = '';

if (!Deno.isatty(Deno.stdin.rid)) {
  for await (const line of readLines(Deno.stdin)) {
    geojson += line
  }
} else {
  if (!filePath) {
    console.log(
      Colors.red("glnmaps <フォルダ/ファイル名> のようにファイルのパスを指定してください。")
    );
    Deno.exit(1);
  } else if (!filePath.endsWith(".csv") && !filePath.endsWith(".geojson")) {
    console.log(
      Colors.red("CSVまたはGeoJSONファイルのパスを指定してください。")
    );
    Deno.exit(1);
  } else if (!await fileExists(filePath)) {
    console.log(
      Colors.red("指定したファイルが存在しません。")
    );
    Deno.exit(1);
  }

  if (filePath.endsWith(".csv")) {
    geojson = await csv2geojson(filePath);
  } else {
    const file: InstanceType<typeof Deno.File> = await Deno.open(filePath);
    const decoder: TextDecoder = new TextDecoder("utf-8");
    geojson = decoder.decode(await readAll(file));
  }
}

serve(handler, { port: 3000 });
console.log(Colors.green("glnmaps is running. Access it at: http://localhost:3000/"));
Deno.run({ cmd: ["open", "http://localhost:3000"] })

const downloadLink = '<p><a href="/download" download="index.html">ソースをダウンロード</a></p>';
let index = `<!DOCTYPE html>
<html lang="ja">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>glnmaps</title>
    <style>
      body,
      html {
        width: 100%;
        height: 100%;
        margin: 0;
        padding: 0;
      }

      .geolonia {
        width: 100%;
        height: 100%;
      }
    </style>
  </head>
  <body>
    {{download-link}}
    <script id="geojson" type="application/json">
      {{geojson}}
    </script>
    <div
      class="geolonia"
      data-geojson="#geojson"
      data-geolocate-control="on"
    ></div>

    <script
      type="text/javascript"
      src="https://cdn.geolonia.com/v1/embed?geolonia-api-key=YOUR-API-KEY"
    ></script>
  </body>
</html>`;

index = index.replace("{{geojson}}", geojson);

function description(_row: any) {
  let desc = "";
  for (const key in _row) {
    desc += `<strong>${key}:</strong> ${_row[key]}<br />`;
  }
  return desc;
}

async function csv2geojson(_csvPath: string) {
  const f = await Deno.open(_csvPath);

  const features = [];
  for await (const row of readCSVObjects(f)) {
    const lat = Number(row["緯度"] || row["緯度（10進法）"] || row["lat"] || row["latitude"]);
    const lng = Number(row["経度"] || row["経度（10進法）"] || row["lng"] || row["longitude"] || row["lon"] || row["long"]);
    const data = {
      type: "Feature",
      geometry: {
        type: "Point",
        coordinates: [lng, lat],
      },
      properties: {
        title: row["名称"] || row["name"],
        description: description(row),
      },
    };
    features.push(data);
  }
  f.close();

  const json = {
    type: "FeatureCollection",
    features: features,
  };
  return JSON.stringify(json);
}

function handler(req: Request): Response {
  const url = new URL(req.url);
  let html;

  if (url.pathname == "/") {
    html = index.replace("{{download-link}}", downloadLink);
    return new Response(html, {
      headers: { "content-type": "text/html" },
    });
  } else if (url.pathname == "/download") {
    html = index.replace("{{download-link}}", "");
    return new Response(html, {
      headers: { "content-type": "text/plain" },
    });
  } else {
    return new Response("Not Found", { status: 404 });
  }
}

async function fileExists(filepath: string): Promise<boolean> {
  try {
    const file = await Deno.stat(filepath);
    return file.isFile;
  } catch (e) {
    return false
  }
}
