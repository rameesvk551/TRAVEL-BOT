import { Link } from 'react-router-dom';
import {
  ArrowRightIcon,
  BoltIcon,
  ChartBarIcon,
  ChatBubbleLeftRightIcon,
  CheckBadgeIcon,
  CursorArrowRaysIcon,
  GlobeAltIcon,
  HomeModernIcon,
  MegaphoneIcon,
  QueueListIcon,
  RocketLaunchIcon,
  ShieldCheckIcon,
  StarIcon,
} from '@heroicons/react/24/outline';
import metaBadge from '../assets/meta_tech_provider_badge.png';

const featureGroups = [
  {
    title: 'WhatsApp Sales Automation',
    description: 'Capture enquiries, verify webhooks, qualify travellers, and drive conversations with fast automated replies.',
    icon: ChatBubbleLeftRightIcon,
    bullets: ['Lead capture state machine', 'Interactive WhatsApp Flows', 'Bilingual chat support'],
  },
  {
    title: 'Lead CRM And Team Handoff',
    description: 'Track every customer from first message to booking with assignment, follow-up, status history, and human takeover.',
    icon: QueueListIcon,
    bullets: ['Lead pipeline tracking', 'Agent assignment and escalation', 'Follow-up management'],
  },
  {
    title: 'Packages And Itineraries',
    description: 'Manage destinations, pricing, brochures, inclusions, exclusions, and day-by-day travel plans from one workspace.',
    icon: GlobeAltIcon,
    bullets: ['Package catalogue', 'Itinerary builder', 'Image and brochure uploads'],
  },
  {
    title: 'Bookings, Payments, And Reviews',
    description: 'Move from quote to confirmed trip with payment tracking, booking visibility, and post-trip feedback collection.',
    icon: ShieldCheckIcon,
    bullets: ['Quote-ready workflow', 'Payment status management', 'Customer review capture'],
  },
  {
    title: 'Properties And Stay Curation',
    description: 'Showcase properties, curate stay options, and support trip planning beyond basic package-only selling.',
    icon: HomeModernIcon,
    bullets: ['Property listings', 'Property details workflow', 'Better stay selection'],
  },
  {
    title: 'Campaigns, Social, And Ads',
    description: 'Run marketing from the same system with templates, campaigns, Instagram workflows, social media, and ad support.',
    icon: MegaphoneIcon,
    bullets: ['Template management', 'Campaign builder', 'Social inbox and insights'],
  },
];

const highlights = [
  { label: 'Core workspaces', value: '10+' },
  { label: 'Client journey', value: 'Lead to review' },
  { label: 'Team flow', value: 'Bot + agent handoff' },
  { label: 'Pitch style', value: 'Ready for demo' },
];

const journey = [
  'Customer sends an enquiry on WhatsApp.',
  'The bot qualifies the lead and collects trip details.',
  'Your team shares packages, itineraries, and property options.',
  'Agents follow up, send quotes, and close the booking.',
  'Payments, reviews, and analytics stay in one system.',
];

const whatsappJourney = [
  {
    step: '01',
    title: 'Customer starts on WhatsApp',
    text: 'A user sends a simple message like "Hi" and the system creates a lead instantly.',
  },
  {
    step: '02',
    title: 'Auto greeting and package menu',
    text: 'The customer sees a welcome message with Domestic and International package choices.',
  },
  {
    step: '03',
    title: 'Package selection flow',
    text: 'Relevant packages appear with price, duration, highlights, and enquiry actions.',
  },
  {
    step: '04',
    title: 'Enquiry form inside WhatsApp',
    text: 'The user submits travel date, travellers, budget, and optional trip notes.',
  },
  {
    step: '05',
    title: 'Agent handoff and booking follow-up',
    text: 'The team gets notified with the full lead summary and can continue the sale fast.',
  },
];

const whatsappMoments = [
  'Auto greeting with travel menu',
  'Domestic and international package selection',
  'Package detail with price and duration',
  'Enquire now, call now, or itinerary download actions',
  'WhatsApp-native enquiry capture',
  'Agent notification after form completion',
];

export default function Brochure() {
  return (
    <div className="min-h-screen overflow-x-hidden bg-[#f6f1e8] text-[#1d1a17]">
      <style>{`
        @media print {
          @page {
            size: A4;
            margin: 12mm;
          }

          body {
            background: #f6f1e8 !important;
          }

          .brochure-print-hide {
            display: none !important;
          }

          .brochure-print-card {
            break-inside: avoid;
            page-break-inside: avoid;
          }

          .brochure-print-section {
            break-inside: avoid;
            page-break-inside: avoid;
          }
        }
      `}</style>
      <div className="absolute inset-x-0 top-0 -z-0 h-[640px] bg-[radial-gradient(circle_at_top_left,_rgba(12,118,110,0.16),_transparent_42%),radial-gradient(circle_at_top_right,_rgba(194,117,58,0.18),_transparent_38%),linear-gradient(180deg,_#f9f4eb_0%,_#f6f1e8_58%,_#f3ede3_100%)]" />

      <main className="relative z-10">
        <section className="px-5 pb-14 pt-6 sm:px-8 lg:px-12 lg:pt-8">
          <div className="mx-auto max-w-7xl">
            <div className="flex flex-col gap-5 rounded-[32px] border border-white/60 bg-white/70 p-4 shadow-[0_24px_80px_-48px_rgba(44,34,24,0.45)] backdrop-blur md:p-6">
              <header className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex items-center gap-4">
                  <div className="flex h-16 w-16 items-center justify-center rounded-[22px] bg-[#16211d] p-2.5 shadow-lg">
                    <img src="/wayon-logo.svg" alt="WAYON logo" className="h-full w-full object-contain brightness-0 invert" />
                  </div>
                  <div>
                    <p className="text-[11px] font-black uppercase tracking-[0.28em] text-[#0c766e]">Client Pitch Brochure</p>
                    <h1 className="mt-1 text-2xl font-black tracking-[-0.04em] text-[#1d1a17] sm:text-3xl">WAYON Platform</h1>
                  </div>
                </div>

                <div className="brochure-print-hide flex flex-wrap items-center gap-3">
                  <a
                    href="#features"
                    className="inline-flex min-h-11 items-center justify-center rounded-full border border-[#d7ccbd] bg-white px-5 text-sm font-semibold text-[#46392f] transition hover:border-[#bfa88d] hover:bg-[#faf6f0]"
                  >
                    View Features
                  </a>
                  <Link
                    to="/login"
                    className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-[#16211d] px-5 text-sm font-semibold text-white transition hover:bg-[#223129]"
                  >
                    Open Dashboard
                    <ArrowRightIcon className="h-4 w-4" />
                  </Link>
                </div>
              </header>

              <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
                <div className="brochure-print-section rounded-[28px] bg-[#fffaf3] p-6 sm:p-8">
                  <div className="inline-flex items-center gap-2 rounded-full border border-[#d8cbba] bg-white px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-[#8a5a35]">
                    <RocketLaunchIcon className="h-4 w-4" />
                    Built for travel sales teams
                  </div>
                  <h2 className="mt-5 max-w-3xl text-4xl font-black leading-[0.95] tracking-[-0.05em] text-[#1d1a17] sm:text-5xl lg:text-6xl">
                    Show customers how WhatsApp becomes a complete travel booking journey.
                  </h2>
                  <p className="mt-5 max-w-2xl text-base leading-7 text-[#5f5147] sm:text-lg">
                    WayOn helps travel brands greet users on WhatsApp, guide them through package selection,
                    collect enquiry details, notify agents, and move the conversation toward booking in one connected flow.
                  </p>

                  <div className="mt-8 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    {highlights.map((item) => (
                      <div key={item.label} className="rounded-[22px] border border-[#eadfce] bg-white p-4">
                        <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#9d856d]">{item.label}</p>
                        <p className="mt-3 text-xl font-black tracking-[-0.04em] text-[#1d1a17]">{item.value}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="grid gap-4">
                  <div className="brochure-print-card rounded-[28px] bg-[#16211d] p-6 text-white shadow-[0_24px_64px_-40px_rgba(14,25,21,0.9)]">
                    <div className="flex items-center gap-3">
                      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10">
                        <BoltIcon className="h-6 w-6" />
                      </div>
                      <div>
                        <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#8bd1c5]">Why clients care</p>
                        <h3 className="mt-1 text-2xl font-black tracking-[-0.04em]">One system, faster closure</h3>
                      </div>
                    </div>
                    <div className="mt-6 space-y-3 text-sm leading-6 text-white/78">
                      <p>Replace scattered chats, spreadsheets, brochures, and manual follow-ups with one focused team workflow.</p>
                      <p>Use it to demonstrate speed, structure, and professionalism during your client pitch.</p>
                    </div>
                  </div>

                  <div className="brochure-print-card rounded-[28px] border border-[#d7ccbd] bg-white p-6">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#0c766e]">Trust signal</p>
                        <h3 className="mt-1 text-2xl font-black tracking-[-0.04em] text-[#1d1a17]">Meta-ready workflow</h3>
                      </div>
                      <CheckBadgeIcon className="h-10 w-10 text-[#0c766e]" />
                    </div>
                    <p className="mt-4 text-sm leading-6 text-[#5f5147]">
                      The product already includes webhook, flow, messaging, and social modules built around modern client communication.
                    </p>
                    <img src={metaBadge} alt="Meta tech provider badge" className="mt-5 h-16 w-auto object-contain" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="features" className="px-5 py-8 sm:px-8 lg:px-12">
          <div className="mx-auto max-w-7xl">
            <div className="mb-8 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.28em] text-[#0c766e]">Feature Overview</p>
                <h2 className="mt-2 text-3xl font-black tracking-[-0.05em] text-[#1d1a17] sm:text-4xl">Everything you can pitch with confidence</h2>
              </div>
              <p className="max-w-2xl text-sm leading-6 text-[#5f5147]">
                This brochure is based on the modules already present in your product, so your pitch stays aligned with the software you can actually show.
              </p>
            </div>

            <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
              {featureGroups.map(({ title, description, icon: Icon, bullets }) => (
                <article key={title} className="brochure-print-card group rounded-[28px] border border-[#e4d8c9] bg-white p-6 shadow-[0_18px_48px_-40px_rgba(44,34,24,0.55)] transition duration-300 hover:-translate-y-1 hover:shadow-[0_28px_64px_-44px_rgba(44,34,24,0.55)]">
                  <div className="flex h-14 w-14 items-center justify-center rounded-[20px] bg-[#eff8f6] text-[#0c766e] transition group-hover:bg-[#16211d] group-hover:text-white">
                    <Icon className="h-7 w-7" />
                  </div>
                  <h3 className="mt-5 text-2xl font-black tracking-[-0.04em] text-[#1d1a17]">{title}</h3>
                  <p className="mt-3 text-sm leading-6 text-[#5f5147]">{description}</p>
                  <div className="mt-5 space-y-2">
                    {bullets.map((bullet) => (
                      <div key={bullet} className="flex items-start gap-3 text-sm font-medium text-[#3d3129]">
                        <StarIcon className="mt-0.5 h-4 w-4 flex-none text-[#c2753a]" />
                        <span>{bullet}</span>
                      </div>
                    ))}
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="px-5 py-8 sm:px-8 lg:px-12">
          <div className="mx-auto max-w-7xl rounded-[32px] border border-[#dccfbe] bg-white p-6 shadow-[0_20px_60px_-45px_rgba(44,34,24,0.5)] sm:p-8">
            <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr]">
              <div className="brochure-print-card rounded-[28px] bg-[#16211d] p-6 text-white">
                <p className="text-[11px] font-black uppercase tracking-[0.28em] text-[#8bd1c5]">WhatsApp Experience</p>
                <h2 className="mt-3 text-3xl font-black tracking-[-0.05em]">What your customer actually sees</h2>
                <p className="mt-4 text-sm leading-7 text-white/78">
                  This is the client-facing story you can present: a customer messages the business, gets guided
                  options, chooses a package, fills a quick enquiry, and is smoothly connected to the sales team.
                </p>
                <div className="mt-6 space-y-3">
                  {whatsappMoments.map((item) => (
                    <div key={item} className="flex items-start gap-3 rounded-[18px] border border-white/10 bg-white/10 p-3">
                      <CheckBadgeIcon className="mt-0.5 h-5 w-5 flex-none text-[#bfeee7]" />
                      <p className="text-sm leading-6 text-white/82">{item}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.28em] text-[#0c766e]">WhatsApp User Journey</p>
                <h2 className="mt-3 text-3xl font-black tracking-[-0.05em] text-[#1d1a17]">From first message to package enquiry</h2>
                <div className="mt-6 space-y-4">
                  {whatsappJourney.map((item) => (
                    <div key={item.step} className="brochure-print-card flex gap-4 rounded-[24px] border border-[#e7dbc9] bg-[#fffaf3] p-4">
                      <div className="flex h-12 w-12 flex-none items-center justify-center rounded-full bg-[#0c766e] text-sm font-black text-white">
                        {item.step}
                      </div>
                      <div>
                        <h3 className="text-lg font-black tracking-[-0.03em] text-[#1d1a17]">{item.title}</h3>
                        <p className="mt-2 text-sm leading-6 text-[#5f5147]">{item.text}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="px-5 py-8 sm:px-8 lg:px-12">
          <div className="mx-auto grid max-w-7xl gap-5 lg:grid-cols-[0.9fr_1.1fr]">
            <div className="brochure-print-card rounded-[30px] bg-[#16211d] p-7 text-white">
              <p className="text-[11px] font-black uppercase tracking-[0.28em] text-[#8bd1c5]">Ideal For</p>
              <h2 className="mt-3 text-3xl font-black tracking-[-0.05em]">Travel businesses that need structure without losing the personal touch</h2>
              <div className="mt-6 space-y-4 text-sm leading-6 text-white/78">
                <p>Use this brochure for agencies, tour operators, destination specialists, travel consultants, and hospitality-focused sales teams.</p>
                <p>It positions your platform as both a CRM and a revenue engine, not just a chatbot.</p>
              </div>
            </div>

            <div className="brochure-print-card rounded-[30px] border border-[#dccfbe] bg-[#fffaf3] p-7">
              <p className="text-[11px] font-black uppercase tracking-[0.28em] text-[#8a5a35]">Client Journey</p>
              <h2 className="mt-3 text-3xl font-black tracking-[-0.05em] text-[#1d1a17]">How the workflow feels in real use</h2>
              <div className="mt-6 space-y-4">
                {journey.map((step, index) => (
                  <div key={step} className="brochure-print-card flex gap-4 rounded-[22px] border border-[#eadfce] bg-white p-4">
                    <div className="flex h-10 w-10 flex-none items-center justify-center rounded-full bg-[#16211d] text-sm font-black text-white">
                      {index + 1}
                    </div>
                    <p className="pt-1 text-sm leading-6 text-[#4b4038]">{step}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="px-5 py-8 sm:px-8 lg:px-12">
          <div className="mx-auto max-w-7xl">
            <div className="mb-8">
              <p className="text-[11px] font-black uppercase tracking-[0.28em] text-[#0c766e]">Visual Story</p>
              <h2 className="mt-2 text-3xl font-black tracking-[-0.05em] text-[#1d1a17] sm:text-4xl">Show a premium brand, not just a software tool</h2>
            </div>

            <div className="grid gap-5 lg:grid-cols-[1.15fr_0.85fr]">
              <div className="brochure-print-card overflow-hidden rounded-[32px] border border-[#dccfbe] bg-white shadow-[0_18px_48px_-40px_rgba(44,34,24,0.55)]">
                <div className="relative aspect-[16/10]">
                  <img src="/login-hero.jpg" alt="Travel concierge dashboard visual" className="h-full w-full object-cover" loading="lazy" decoding="async" />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#16211d]/70 via-[#16211d]/10 to-transparent" />
                  <div className="absolute bottom-0 left-0 right-0 p-6 text-white">
                    <p className="text-[11px] font-black uppercase tracking-[0.24em] text-[#bfeee7]">Premium Positioning</p>
                    <h3 className="mt-2 text-2xl font-black tracking-[-0.04em]">A modern travel operating system for fast-moving sales teams</h3>
                  </div>
                </div>
              </div>

              <div className="grid gap-5">
                <div className="brochure-print-card overflow-hidden rounded-[32px] border border-[#dccfbe] bg-white shadow-[0_18px_48px_-40px_rgba(44,34,24,0.55)]">
                  <div className="relative aspect-[16/11]">
                    <img src="/signup-hero.jpg" alt="Travel planning and booking visual" className="h-full w-full object-cover" loading="lazy" decoding="async" />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#8a5a35]/65 via-transparent to-transparent" />
                  </div>
                  <div className="p-5">
                    <h3 className="text-xl font-black tracking-[-0.04em] text-[#1d1a17]">Designed to impress in discovery calls and client demos</h3>
                    <p className="mt-3 text-sm leading-6 text-[#5f5147]">Use the brochure to set the narrative, then walk the client through the product workflow live.</p>
                  </div>
                </div>

                <div className="brochure-print-card rounded-[32px] border border-[#dccfbe] bg-[#fffaf3] p-6">
                  <p className="text-[11px] font-black uppercase tracking-[0.24em] text-[#8a5a35]">Pitch Angles</p>
                  <div className="mt-4 grid gap-3">
                    <div className="flex items-start gap-3 rounded-[20px] bg-white p-4">
                      <RocketLaunchIcon className="mt-0.5 h-5 w-5 flex-none text-[#0c766e]" />
                      <div>
                        <p className="text-sm font-bold text-[#1d1a17]">Speed to response</p>
                        <p className="mt-1 text-sm leading-6 text-[#5f5147]">Automate first contact and reduce delay after enquiries arrive.</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3 rounded-[20px] bg-white p-4">
                      <ShieldCheckIcon className="mt-0.5 h-5 w-5 flex-none text-[#0c766e]" />
                      <div>
                        <p className="text-sm font-bold text-[#1d1a17]">Operational clarity</p>
                        <p className="mt-1 text-sm leading-6 text-[#5f5147]">Keep leads, packages, agents, bookings, and payments in one place.</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3 rounded-[20px] bg-white p-4">
                      <MegaphoneIcon className="mt-0.5 h-5 w-5 flex-none text-[#0c766e]" />
                      <div>
                        <p className="text-sm font-bold text-[#1d1a17]">Growth support</p>
                        <p className="mt-1 text-sm leading-6 text-[#5f5147]">Pitch campaigns, social workflows, and reporting as part of the value.</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="px-5 py-8 sm:px-8 lg:px-12">
          <div className="mx-auto max-w-7xl">
            <div className="grid gap-5 lg:grid-cols-3">
              <div className="brochure-print-card rounded-[28px] border border-[#e4d8c9] bg-white p-6">
                <ChatBubbleLeftRightIcon className="h-8 w-8 text-[#0c766e]" />
                <h3 className="mt-4 text-2xl font-black tracking-[-0.04em] text-[#1d1a17]">Customer Entry</h3>
                <p className="mt-3 text-sm leading-6 text-[#5f5147]">
                  Users start naturally on WhatsApp without needing an app download or a separate website flow.
                </p>
              </div>
              <div className="brochure-print-card rounded-[28px] border border-[#e4d8c9] bg-white p-6">
                <GlobeAltIcon className="h-8 w-8 text-[#0c766e]" />
                <h3 className="mt-4 text-2xl font-black tracking-[-0.04em] text-[#1d1a17]">Package Discovery</h3>
                <p className="mt-3 text-sm leading-6 text-[#5f5147]">
                  Customers browse domestic or international options and move directly into package-level intent.
                </p>
              </div>
              <div className="brochure-print-card rounded-[28px] border border-[#e4d8c9] bg-white p-6">
                <QueueListIcon className="h-8 w-8 text-[#0c766e]" />
                <h3 className="mt-4 text-2xl font-black tracking-[-0.04em] text-[#1d1a17]">Sales Conversion</h3>
                <p className="mt-3 text-sm leading-6 text-[#5f5147]">
                  Once the user submits an enquiry, your team receives the context needed to reply quickly and close.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="px-5 py-8 pb-14 sm:px-8 lg:px-12">
          <div className="brochure-print-section mx-auto max-w-7xl rounded-[34px] bg-[linear-gradient(135deg,_#16211d_0%,_#0c766e_100%)] p-7 text-white shadow-[0_30px_100px_-55px_rgba(12,118,110,0.9)] sm:p-9">
            <div className="grid gap-7 lg:grid-cols-[1.1fr_0.9fr] lg:items-end">
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.28em] text-[#bfeee7]">Pitch Closing Section</p>
                <h2 className="mt-3 text-3xl font-black tracking-[-0.05em] sm:text-4xl">Present a travel platform that looks serious, connected, and ready to scale.</h2>
                <p className="mt-4 max-w-2xl text-sm leading-7 text-white/78">
                  Open this brochure during your meeting, then move straight into the live dashboard to show leads, packages, campaigns, analytics, and operations in action.
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-[24px] border border-white/15 bg-white/10 p-5">
                  <CursorArrowRaysIcon className="h-7 w-7 text-[#bfeee7]" />
                  <p className="mt-4 text-lg font-black tracking-[-0.03em]">Live demo ready</p>
                  <p className="mt-2 text-sm leading-6 text-white/72">Use the brochure as your opener and the dashboard as proof.</p>
                </div>
                <div className="rounded-[24px] border border-white/15 bg-white/10 p-5">
                  <ChartBarIcon className="h-7 w-7 text-[#ffe1c7]" />
                  <p className="mt-4 text-lg font-black tracking-[-0.03em]">Operations + growth</p>
                  <p className="mt-2 text-sm leading-6 text-white/72">Show both revenue workflow and marketing capability in one pitch.</p>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
