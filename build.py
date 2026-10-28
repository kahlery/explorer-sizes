#!/usr/bin/env python3
# Packs extension/ into explorer-sizes.vsix and installs it:  python3 build.py
import json, os, subprocess, zipfile

HERE = os.path.dirname(os.path.abspath(__file__))
pkg = json.load(open(os.path.join(HERE, "extension", "package.json")))
manifest = f"""<?xml version="1.0" encoding="utf-8"?>
<PackageManifest Version="2.0.0" xmlns="http://schemas.microsoft.com/developer/vsx-schema/2011">
  <Metadata>
    <Identity Language="en-US" Id="{pkg['name']}" Version="{pkg['version']}" Publisher="{pkg['publisher']}"/>
    <DisplayName>{pkg['displayName']}</DisplayName>
    <Description xml:space="preserve">{pkg['description']}</Description>
    <Properties><Property Id="Microsoft.VisualStudio.Code.Engine" Value="{pkg['engines']['vscode']}"/></Properties>
  </Metadata>
  <Installation><InstallationTarget Id="Microsoft.VisualStudio.Code"/></Installation>
  <Dependencies/>
  <Assets>
    <Asset Type="Microsoft.VisualStudio.Code.Manifest" Path="extension/package.json" Addressable="true"/>
    <Asset Type="Microsoft.VisualStudio.Services.Icons.Default" Path="extension/icon.png" Addressable="true"/>
  </Assets>
</PackageManifest>
"""
types = ('<?xml version="1.0" encoding="utf-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
         '<Default Extension=".json" ContentType="application/json"/><Default Extension=".js" ContentType="application/javascript"/>'
         '<Default Extension=".vsixmanifest" ContentType="text/xml"/><Default Extension=".png" ContentType="image/png"/>'
         '<Default Extension=".md" ContentType="text/markdown"/><Default Extension=".txt" ContentType="text/plain"/>'
         '<Default Extension="" ContentType="text/plain"/></Types>')
vsix = os.path.join(HERE, "explorer-sizes.vsix")
with zipfile.ZipFile(vsix, "w", zipfile.ZIP_DEFLATED) as z:
    z.writestr("[Content_Types].xml", types)
    z.writestr("extension.vsixmanifest", manifest)
    root = os.path.join(HERE, "extension")
    for folder, _, names in os.walk(root):
        for name in sorted(names):
            path = os.path.join(folder, name)
            z.write(path, "extension/" + os.path.relpath(path, root).replace(os.sep, "/"))
subprocess.run(["code", "--install-extension", vsix, "--force"], check=True)
