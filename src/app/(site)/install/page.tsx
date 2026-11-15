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
          <p className="mt-8 text-sm leading-relaxed text-dim">
            It takes about two minutes and you only do it once. You need a computer (Windows or Mac) with Chrome. It
            does not work on a phone. Follow the steps in order; each one says what you should see.
          </p>
          <div className="mt-6">
            <Points
              items={[
                [
                  '1 · DOWNLOAD',
                  'Press the green DOWNLOAD EXTENSION button above. A file called radar-extension.zip lands in your Downloads folder.',
                ],
                [
                  '2 · UNZIP',
                  'Open your Downloads folder. Right-click radar-extension.zip and choose Extract All (on a Mac, double-click it). You now have a normal folder called radar-extension. Leave it where it is: Chrome reads the extension from this folder, so deleting or moving it later switches the extension off.',
                ],
                [
                  '3 · OPEN THE PAGE',
                  'In Chrome, click the address bar at the top, type chrome://extensions and press Enter. A page titled Extensions opens. (In Microsoft Edge the address is edge://extensions.)',
                ],
                [
                  '4 · DEVELOPER MODE',
                  'Find the switch named Developer mode (top right in Chrome, left side in Edge) and turn it on. Three new buttons appear. This switch only lets you add an extension from a folder; it changes nothing else.',
                ],
                [
                  '5 · LOAD IT',
                  'Click Load unpacked. A file window opens. Click the radar-extension folder once, then press Select Folder. A card named RADAR · Auto-Fill appears on the page. That means it is installed.',
                ],
                [
                  '6 · CHECK IT WORKS',
                  'Go back to your RADAR dashboard and refresh the page (press F5). Every job card now shows a ↯ HACK button. If you see it, you are done.',
                ],
                [
                  '7 · ADD YOUR RESUME',
                  'One time only: open Preferences in RADAR and upload your resume PDF in this same browser. RADAR keeps it on your computer and attaches it to forms for you.',
                ],
                [
                  'HOW TO USE IT',
                  'Press ↯ HACK on a job. The application form opens in a new tab with your details already typed in. Read it, fix anything you like, and press Submit yourself. Keep the RADAR tab open while the form fills.',
                ],
                [
                  'NO ↯ HACK BUTTON?',
                  'Refresh the dashboard once more. Check the RADAR · Auto-Fill card on the Extensions page is switched on (blue). Check the radar-extension folder is still where you unzipped it. If Chrome shows "Disable developer mode extensions", press Cancel or close that box.',
                ],
                [
                  'UPDATING',
                  'Download the new zip, unzip it over the old folder, then press the round reload arrow on the RADAR · Auto-Fill card.',
                ],
                [
                  'REMOVING',
                  'On the Extensions page press Remove on the RADAR · Auto-Fill card. Nothing else on your computer changes.',
                ],
              ]}
            />
          </div>
        </DocSection>
      </DocLayout>
    </>
  );
}
