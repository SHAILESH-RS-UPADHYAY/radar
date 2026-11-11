import type { Metadata } from 'next';
import { DocLayout, DocSection, PageHero, Points } from '@/components/site/Doc';
import { HudPanel } from '@/components/hud/Hud';
import { InstallButton } from '@/components/site/InstallButton';
import ext from '../../../../extension/manifest.json';

export const metadata: Metadata = {
  title: 'Install',
  description: 'Install RADAR as an app on your phone or computer, and add the RADAR extension to Chrome.',
};

const TOC = [
  { id: 'app', label: 'THE_APP' },
  { id: 'extension', label: 'THE_EXTENSION' },
];

export default function InstallPage() {
  return (
    <>
      <PageHero
        command="./install --everywhere"
        title="INSTALL"
        lead="RADAR runs in the browser, so there is nothing to sign up for twice. Install it as an app for a home-screen icon and a window of its own, and add the extension to fill application forms in one click."
        meta={[
          ['APP', 'PHONE · PC · MAC'],
          ['EXTENSION', 'v' + ext.version],
          ['STORE', 'NOT NEEDED'],
          ['PRICE', 'FREE'],
        ]}
      />
      <DocLayout toc={TOC}>
        <DocSection id="app" index="01" kicker="THE_APP" title="RADAR as an app">
          <HudPanel label="INSTALL://APP" tone="ok" bodyClassName="p-6">
            <p className="mb-5 text-sm leading-relaxed text-dim">
              Same account, same jobs, same look. It opens in its own window, sits on your home screen or taskbar, and
              updates by itself.
            </p>
            <InstallButton />
            <div className="mt-6 border-t border-phosphor/15 pt-5">
              <p className="mb-3 text-sm leading-relaxed text-dim">
                Prefer a file on Android? Download the APK, open it, and allow your browser to install apps when your
                phone asks. It is the same RADAR, full screen.
              </p>
              <a
                href="/radar.apk"
                download
                className="inline-block border border-phosphor/50 px-6 py-3 font-mono text-xs font-bold tracking-[0.25em] text-phosphor transition-colors hover:bg-phosphor/10"
              >
                ⤓ DOWNLOAD ANDROID APK (1.3 MB)
              </a>
            </div>
          </HudPanel>
          <div className="mt-8">
            <Points
              items={[
                ['WINDOWS · MAC', 'Chrome or Edge → install icon in the address bar → Install.'],
                ['ANDROID', 'Chrome → ⋮ menu → Add to Home screen → Install. Or download the APK above.'],
                ['IPHONE · IPAD', 'Safari → Share → Add to Home Screen.'],
              ]}
            />
          </div>
        </DocSection>

        <DocSection id="extension" index="02" kicker="THE_EXTENSION" title="The RADAR extension (Chrome, computer)">
          <HudPanel label="INSTALL://EXTENSION" status={'v' + ext.version} tone="info" bodyClassName="p-6">
            <p className="mb-5 text-sm leading-relaxed text-dim">
              Optional. With it, ↯ HACK opens an application form already filled with your answers and resume. You check
              everything and press Submit yourself; RADAR never submits for you.
            </p>
            <a
              href="/radar-extension.zip"
              download
              className="inline-block bg-phosphor px-6 py-3 font-mono text-xs font-bold tracking-[0.25em] text-black transition-colors hover:bg-phosphor-hi"
            >
              ⤓ DOWNLOAD EXTENSION (.ZIP)
            </a>
          </HudPanel>
          <div className="mt-8">
            <Points
              items={[
                ['1 · UNZIP', 'Extract the zip. You get a folder called radar-extension.'],
                ['2 · OPEN', 'In Chrome go to chrome://extensions and turn on Developer mode (top right).'],
                ['3 · LOAD', 'Click Load unpacked and choose the radar-extension folder.'],
                ['4 · CONNECT', 'Open your RADAR dashboard. Preferences shows the extension as connected.'],
                ['UPDATING', 'Download the new zip, replace the folder, and press the reload arrow on the extension.'],
              ]}
            />
          </div>
        </DocSection>
      </DocLayout>
    </>
  );
}
