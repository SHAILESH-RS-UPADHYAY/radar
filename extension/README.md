# RADAR · Auto-Fill

One click in RADAR opens a job's application form **already filled**: your answers, your links and the tailored PDF.
You review it and press the employer's Submit. RADAR logs the application.

```text
RADAR card  ↯ ONE-CLICK APPLY
   │  the form opens in a new tab at once
   │  meanwhile RADAR reads that form and drafts its answers (Application Kit + AI, in your voice)
   ▼
form tab    RADAR://FILL panel: DRAFTING → FILLING → READY
   │  fields filled, PDF attached, Submit marked, "NEEDS YOU" lists what is left
   ▼
you         check, answer the rest, press Submit
   │  the employer confirms (or you press ✓ I SUBMITTED IT)
   ▼
RADAR       C2 · OPS: applied, with the tailored resume that went out
```

## Install (2 minutes)

1. Chrome → `chrome://extensions` → switch on **Developer mode** (top right).
2. **Load unpacked** → pick this `extension/` folder.
3. Open RADAR (or reload it). **Settings → Application Kit** shows `EXTENSION://RADAR-AUTO-FILL · CONNECTED`, and the
   cards in DISCOVERY and THE VAULT show **↯ ONE-CLICK APPLY**.

After changing a file here: `chrome://extensions` → RADAR · Auto-Fill → ⟳ reload, then reload the RADAR tab.

## What it will and will not do

| Does                                                                           | Never                                                                               |
| ------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------- |
| fills text, dropdowns (also React selects), radios, checkboxes, the resume PDF | presses Submit, Next or Apply                                                       |
| keeps whatever is already in a field                                           | touches a CAPTCHA                                                                   |
| waits for a form that opens late (an Apply button, a modal), up to 10 minutes  | runs in a tab RADAR did not open                                                    |
| fills a form embedded in a frame (Greenhouse on a company's own site)          | fills LinkedIn or Indeed (their terms forbid automation)                            |
| fills each step of a multi-step form                                           | sends anything anywhere: answers go from RADAR to your page                         |
| lists the required fields still empty, with a jump to each                     | logs an application the employer did not confirm, unless you press ✓ I SUBMITTED IT |

## Where it works

| Form                                                       | How                                                                                                                                                         |
| ---------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Greenhouse (also boards that redirect to their own site)   | opened on Greenhouse's embed form; every question by its field name                                                                                         |
| Lever                                                      | opened on `/apply`; custom questions by their card ids                                                                                                      |
| Ashby                                                      | opened on `/application`; standard fields by label + the "why" answer                                                                                       |
| any other page (Workable, SmartRecruiters, company sites…) | standard fields by label (name, email, phone, links, location) + the "why" answer + PDF                                                                     |
| YC startups                                                | their jobs come through their ATS above. Work at a Startup's own form needs your YC login: open it, press its Apply, and the note to the founders is filled |

Accounts (Workday, iCIMS sign-ups), CAPTCHAs and questions only you can answer (consents, arbitration, EEO) stay with
you; the panel lists them.

## Files

| File              | Role                                                                                                     |
| ----------------- | -------------------------------------------------------------------------------------------------------- |
| `manifest.json`   | Manifest V3; permissions below                                                                           |
| `background.js`   | service worker: opens the form tab, keeps its answers in session memory, injects `fill.js` into that tab |
| `radar-bridge.js` | runs only on RADAR's own pages; relays between the page (`window.postMessage`) and the worker            |
| `fill.js`         | in the form tab: finds the form, fills it, the RADAR://FILL panel, watches for the confirmation          |
| `icons/`          | the radar mark, 16–128 px                                                                                |

The page side is `src/lib/extension.ts` (`useExtension`, `launchInExtension`, `armInExtension`, `onExtension`); the
answers come from `POST /api/apply/prepare`, the form link from `applicationFormUrl` in `src/lib/apply/form.ts`.

### Messages

| From → to         | Message                                           | Meaning                                                |
| ----------------- | ------------------------------------------------- | ------------------------------------------------------ |
| RADAR → worker    | `launch {url, matchId, tailoredId, packet?}`      | open the form now (answers may follow)                 |
| RADAR → worker    | `arm {matchId, packet}` or `arm {matchId, error}` | the answers for that tab, or why there are none        |
| form tab → worker | `packet`                                          | "what are my answers?" (none yet = still drafting)     |
| form tab → worker | `filled {filled, needs, lines, labels}`           | relayed to RADAR, and to the page's panel from a frame |
| form tab → worker | `armed` · `submitted`                             | you pressed Submit · the employer confirmed it         |
| worker → RADAR    | `launched` · `filled` · `applied`                 | RADAR shows a toast and logs the application           |

## Permissions, and why

| Permission                    | Why                                                                                         |
| ----------------------------- | ------------------------------------------------------------------------------------------- |
| `storage`                     | `chrome.storage.session`: the open form tabs and their answers, in memory only              |
| `scripting` + `webNavigation` | put `fill.js` into the tab RADAR opened, after each page load and into its form frames      |
| host access `<all_urls>`      | an application form can be on any company's site; the worker still only enters RADAR's tabs |

## Privacy

Answers and the PDF travel from your RADAR tab to the form tab inside your browser. They are held in session memory
(gone when the browser closes, or when that tab closes) and never sent to a server by the extension.

## Test

`chrome://extensions` → load it, open RADAR, press ↯ ONE-CLICK APPLY on a Greenhouse or Lever job and do **not**
submit: the panel should reach READY with the PDF attached and Submit marked. A tab you open yourself shows no panel.
