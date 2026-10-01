require "json"

root = File.expand_path(__dir__)
html = File.read(File.join(root, "index.html"), encoding: "UTF-8")
css = File.read(File.join(root, "styles.css"), encoding: "UTF-8")
javascript = File.read(File.join(root, "app.js"), encoding: "UTF-8")
data = JSON.parse(File.read(File.join(root, "data/results.json"), encoding: "UTF-8"))

json = JSON.generate(data, ensure_ascii: false).gsub("</", "<\\/")
javascript = javascript.gsub("window.MM_RESULTS || await d3.json('data/results.json')", "window.MM_RESULTS")
page = html
  .sub(/\s*<link rel="stylesheet" href="styles\.css">/, "\n  <style>\n#{css}\n  </style>")
  .sub(/\s*<script src="app\.js"><\/script>/, "\n  <script>window.MM_RESULTS = #{json};</script>\n  <script>\n#{javascript}\n  </script>")

output = File.join(root, "mm-2026-datalens.html")
File.write(output, page)
puts "#{output}: #{File.size(output)} bytes"
