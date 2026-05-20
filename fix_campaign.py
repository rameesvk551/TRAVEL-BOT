import re

with open('c:/Users/ACER/www/travel-bot/frontend/src/pages/CreateCampaign.jsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Fix alignment
content = content.replace(
    '<div className="mx-auto flex min-w-[560px] items-center justify-between sm:max-w-2xl">',
    '<div className="mx-auto flex min-w-[560px] items-start justify-between sm:max-w-2xl">'
)

content = content.replace(
    '<div className="flex-1 mx-2">',
    '<div className="flex-1 mx-2 mt-5">'
)

# Remove Page Header block using precise regex
content = re.sub(
    r'\s*\{\/\* ── Page Header ── \*\/\}[\s\S]*?\{\/\* ── Main Card ── \*\/\}',
    '\n\n      {/* ── Main Card ── */}',
    content
)

# Remove Campaign Identity header block
content = re.sub(
    r'\s*<div className="wizard-section-header">[\s\S]*?<div className="flex items-center gap-2 text-xs font-bold uppercase tracking-\[0\.2em\] text-\[#404040\] mb-2">[\s\S]*?<Target className="w-3\.5 h-3\.5" \/>[\s\S]*?Campaign Identity[\s\S]*?<\/div>[\s\S]*?<h2 className="text-lg font-bold text-slate-900">Give your campaign a name<\/h2>[\s\S]*?<p className="text-sm text-slate-500 mt-0\.5">Choose a descriptive name and type that represents this campaign\'s purpose\.<\/p>[\s\S]*?<\/div>\s*',
    '\n\n',
    content
)

with open('c:/Users/ACER/www/travel-bot/frontend/src/pages/CreateCampaign.jsx', 'w', encoding='utf-8') as f:
    f.write(content)

print("Done")
