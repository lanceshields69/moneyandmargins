export interface SourceNominee {
  name: string
  ballotParty: string
  provisional?: boolean
  provisionalReason?: string
}

export interface SourceRace {
  state: string
  raceName: string
  isSpecial: boolean
  sourceUrl: string
  sourceTier: 'official' | 'secondary_wikipedia'
  note?: string
  nominees: SourceNominee[]
}

const RETRIEVED_AT = '2026-10-30'

export { RETRIEVED_AT }

export const SOURCE_RACES: SourceRace[] = [
  {
    state: 'AK',
    raceName: 'Alaska Senate 2026',
    isSpecial: false,
    sourceUrl:
      'https://en.wikipedia.org/w/index.php?title=2026_United_States_Senate_election_in_Alaska&oldid=1382905118',
    sourceTier: 'secondary_wikipedia',
    note: 'Alaska uses a top-four nonpartisan primary; all four advancers appear on one ranked-choice general ballot, so two Republicans (Sullivan, Heikes) are both nominees. Daniel J. Sullivan Jr. advanced with no listed party and is reportedly the subject of a name-confusion/spoiler-candidate lawsuit — needs your attention before inclusion.',
    nominees: [
      { name: 'Dan Sullivan', ballotParty: 'Republican' },
      { name: 'Mary Peltola', ballotParty: 'Democratic' },
      {
        name: 'Gerald L. Heikes',
        ballotParty: 'Republican',
        provisional: true,
        provisionalReason: 'Second Republican advancer under Alaska\'s top-four primary system.',
      },
      // Daniel J. Sullivan Jr. (Undeclared; certified on the Alaska general ballot) is
      // left out of the MVP: not a major-party nominee. FEC ID S6AK00326 is released.
    ],
  },
  {
    state: 'AL',
    raceName: 'Alabama Senate 2026',
    isSpecial: false,
    sourceUrl:
      'https://en.wikipedia.org/w/index.php?title=2026_United_States_Senate_election_in_Alabama&oldid=1382650719',
    sourceTier: 'secondary_wikipedia',
    nominees: [
      { name: 'Barry Moore', ballotParty: 'Republican' },
      { name: 'Everett Wess', ballotParty: 'Democratic' },
    ],
  },
  {
    state: 'AR',
    raceName: 'Arkansas Senate 2026',
    isSpecial: false,
    sourceUrl:
      'https://en.wikipedia.org/w/index.php?title=2026_United_States_Senate_election_in_Arkansas&oldid=1382505566',
    sourceTier: 'secondary_wikipedia',
    nominees: [
      { name: 'Tom Cotton', ballotParty: 'Republican' },
      { name: 'Hallie Shoffner', ballotParty: 'Democratic' },
      { name: 'Jeff Wadlin', ballotParty: 'Libertarian', provisional: true },
    ],
  },
  {
    state: 'CO',
    raceName: 'Colorado Senate 2026',
    isSpecial: false,
    sourceUrl:
      'https://en.wikipedia.org/w/index.php?title=2026_United_States_Senate_election_in_Colorado&oldid=1382698367',
    sourceTier: 'secondary_wikipedia',
    note: 'Bob Chew (Forward Party) reported ~$3.6M raised, far outpacing minor rivals — included as provisional pending the real independent-expenditure check in prompt 2b, but worth separate confirmation of his seriousness as a contender.',
    nominees: [
      { name: 'John Hickenlooper', ballotParty: 'Democratic' },
      { name: 'Mark Baisley', ballotParty: 'Republican' },
      { name: 'Bob Chew', ballotParty: 'Forward', provisional: true, provisionalReason: 'Well-funded minor-party candidate (~$3.6M raised).' },
      { name: 'Blake Huber', ballotParty: 'Libertarian', provisional: true },
      { name: 'Adam Withrow', ballotParty: 'Unity', provisional: true },
      { name: 'Christopher Baum', ballotParty: 'Approval Voting', provisional: true },
    ],
  },
  {
    state: 'DE',
    raceName: 'Delaware Senate 2026',
    isSpecial: false,
    sourceUrl:
      'https://en.wikipedia.org/w/index.php?title=2026_United_States_Senate_election_in_Delaware&oldid=1382505642',
    sourceTier: 'secondary_wikipedia',
    nominees: [
      { name: 'Chris Coons', ballotParty: 'Democratic' },
      { name: 'Michael Katz', ballotParty: 'Republican' },
    ],
  },
  {
    state: 'FL',
    raceName: 'Florida Senate special election 2026',
    isSpecial: true,
    sourceUrl:
      'https://en.wikipedia.org/w/index.php?title=2026_United_States_Senate_special_election_in_Florida&oldid=1382875301',
    sourceTier: 'secondary_wikipedia',
    note: 'Special election for the seat Marco Rubio vacated; Ashley Moody was appointed and is the Republican nominee. Neil J. Gillespie\'s ballot qualification is ambiguous in the source (listed "Declared" but also appears in the results table) — flagged for confirmation.',
    nominees: [
      { name: 'Ashley Moody', ballotParty: 'Republican' },
      { name: 'Angie Nixon', ballotParty: 'Democratic' },
      {
        name: 'Neil J. Gillespie',
        ballotParty: 'Independent',
        provisional: true,
        provisionalReason: 'Ballot qualification ambiguous in source — confirm before final inclusion.',
      },
    ],
  },
  {
    state: 'GA',
    raceName: 'Georgia Senate 2026',
    isSpecial: false,
    sourceUrl:
      'https://en.wikipedia.org/w/index.php?title=2026_United_States_Senate_election_in_Georgia&oldid=1382671629',
    sourceTier: 'secondary_wikipedia',
    note: 'No Libertarian on the ballot this cycle per contemporaneous AJC reporting cited in the source article.',
    nominees: [
      { name: 'Jon Ossoff', ballotParty: 'Democratic' },
      { name: 'Mike Collins', ballotParty: 'Republican' },
    ],
  },
  {
    state: 'IA',
    raceName: 'Iowa Senate 2026',
    isSpecial: false,
    sourceUrl:
      'https://en.wikipedia.org/w/index.php?title=2026_United_States_Senate_election_in_Iowa&oldid=1382889743',
    sourceTier: 'secondary_wikipedia',
    nominees: [
      { name: 'Ashley Hinson', ballotParty: 'Republican' },
      { name: 'Josh Turek', ballotParty: 'Democratic' },
      { name: 'Thomas Laehn', ballotParty: 'Libertarian', provisional: true },
    ],
  },
  {
    state: 'ID',
    raceName: 'Idaho Senate 2026',
    isSpecial: false,
    sourceUrl:
      'https://en.wikipedia.org/w/index.php?title=2026_United_States_Senate_election_in_Idaho&oldid=1382544118',
    sourceTier: 'secondary_wikipedia',
    note: 'Democrat David Roth withdrew; party fielded no replacement, so there is no Democratic nominee this cycle. Todd Achilles (independent, former Democratic state rep) is the main challenger to Risch.',
    nominees: [
      { name: 'Jim Risch', ballotParty: 'Republican' },
      { name: 'Todd Achilles', ballotParty: 'Independent', provisional: true, provisionalReason: 'Main challenger to Risch, competitive polling.' },
      { name: 'Natalie Fleming', ballotParty: 'Independent', provisional: true },
      { name: 'Matt Loesby', ballotParty: 'Libertarian', provisional: true },
    ],
  },
  {
    state: 'IL',
    raceName: 'Illinois Senate 2026',
    isSpecial: false,
    sourceUrl:
      'https://en.wikipedia.org/w/index.php?title=2026_United_States_Senate_election_in_Illinois&oldid=1382652997',
    sourceTier: 'secondary_wikipedia',
    nominees: [
      { name: 'Juliana Stratton', ballotParty: 'Democratic' },
      { name: 'Don Tracy', ballotParty: 'Republican' },
      { name: 'Whitfield Harrington Jr.', ballotParty: 'American Center', provisional: true },
    ],
  },
  {
    state: 'KS',
    raceName: 'Kansas Senate 2026',
    isSpecial: false,
    sourceUrl:
      'https://en.wikipedia.org/w/index.php?title=2026_United_States_Senate_election_in_Kansas&oldid=1382860414',
    sourceTier: 'secondary_wikipedia',
    nominees: [
      { name: 'Roger Marshall', ballotParty: 'Republican' },
      { name: 'Adam Hamilton', ballotParty: 'Democratic' },
      { name: 'David C. Graham', ballotParty: 'Libertarian', provisional: true },
    ],
  },
  {
    state: 'KY',
    raceName: 'Kentucky Senate 2026',
    isSpecial: false,
    sourceUrl:
      'https://en.wikipedia.org/w/index.php?title=2026_United_States_Senate_election_in_Kentucky&oldid=1382521640',
    sourceTier: 'secondary_wikipedia',
    nominees: [
      { name: 'Andy Barr', ballotParty: 'Republican' },
      { name: 'Charles Booker', ballotParty: 'Democratic' },
      { name: 'Christopher Todd Campbell', ballotParty: 'Kentucky Party', provisional: true },
    ],
  },
  {
    state: 'LA',
    raceName: 'Louisiana Senate 2026',
    isSpecial: false,
    sourceUrl:
      'https://en.wikipedia.org/w/index.php?title=2026_United_States_Senate_election_in_Louisiana&oldid=1382879962',
    sourceTier: 'secondary_wikipedia',
    note: 'Louisiana eliminated its jungle primary for this cycle (traditional party primaries + runoffs, effective 2026). Incumbent Bill Cassidy was eliminated in his own primary. Confirmed independently via AP/local news (WAFB, Fox8, KNOE): Letlow and Davis are the only two general-election nominees.',
    nominees: [
      { name: 'Julia Letlow', ballotParty: 'Republican' },
      { name: 'Jamie Davis', ballotParty: 'Democratic' },
    ],
  },
  {
    state: 'MA',
    raceName: 'Massachusetts Senate 2026',
    isSpecial: false,
    sourceUrl:
      'https://en.wikipedia.org/w/index.php?title=2026_United_States_Senate_election_in_Massachusetts&oldid=1382543934',
    sourceTier: 'secondary_wikipedia',
    nominees: [
      { name: 'Ed Markey', ballotParty: 'Democratic' },
      { name: 'John Deaton', ballotParty: 'Republican' },
      { name: 'Joe Tache', ballotParty: 'Party for Socialism and Liberation', provisional: true, provisionalReason: 'Received a debate invitation, polled 1-3%.' },
      { name: 'Shiva Ayyadurai', ballotParty: 'Independent', provisional: true, provisionalReason: 'Perennial statewide candidate.' },
    ],
  },
  {
    state: 'ME',
    raceName: 'Maine Senate 2026',
    isSpecial: false,
    sourceUrl:
      'https://en.wikipedia.org/w/index.php?title=2026_United_States_Senate_election_in_Maine&oldid=1382878153',
    sourceTier: 'secondary_wikipedia',
    note: 'Graham Platner won the Democratic track but withdrew; Troy Jackson was chosen as replacement nominee at a July 25 convention.',
    nominees: [
      { name: 'Susan Collins', ballotParty: 'Republican' },
      { name: 'Troy Jackson', ballotParty: 'Democratic' },
    ],
  },
  {
    state: 'MI',
    raceName: 'Michigan Senate 2026',
    isSpecial: false,
    sourceUrl:
      'https://en.wikipedia.org/w/index.php?title=2026_United_States_Senate_election_in_Michigan&oldid=1382905134',
    sourceTier: 'secondary_wikipedia',
    note: 'Ballot status for the four minor-party candidates below was not fully confirmed from the fetched article text (they appeared in a "Third parties and independents" section, not a certified results table) — flagged for your review.',
    nominees: [
      { name: 'Abdul El-Sayed', ballotParty: 'Democratic' },
      { name: 'Mike Rogers', ballotParty: 'Republican' },
      { name: 'Lydia Christensen', ballotParty: 'Libertarian', provisional: true, provisionalReason: 'Ballot status not fully confirmed by source.' },
      { name: 'Douglas P. Marsh', ballotParty: 'Green', provisional: true, provisionalReason: 'Ballot status not fully confirmed by source.' },
      { name: 'Tim Long', ballotParty: 'U.S. Taxpayers', provisional: true, provisionalReason: 'Ballot status not fully confirmed by source.' },
      { name: 'Walter P. Kristy', ballotParty: 'Natural Law', provisional: true, provisionalReason: 'Ballot status not fully confirmed by source.' },
    ],
  },
  {
    state: 'MN',
    raceName: 'Minnesota Senate 2026',
    isSpecial: false,
    sourceUrl:
      'https://en.wikipedia.org/w/index.php?title=2026_United_States_Senate_election_in_Minnesota&oldid=1382794413',
    sourceTier: 'secondary_wikipedia',
    note: 'Peggy Flanagan is a nickname for Margaret Flanagan (her FEC filing name) — fuzzy name matching required. Rebecca Whiting\'s party is labeled "Libertarian" in the results table but "(G)"/Green in a polling footnote elsewhere in the same article — discrepancy unresolved, flagged.',
    nominees: [
      { name: 'Peggy Flanagan', ballotParty: 'DFL' },
      { name: 'Michele Tafoya', ballotParty: 'Republican' },
      { name: 'Marisa Simonetti', ballotParty: 'Independent', provisional: true },
      { name: 'Rebecca Whiting', ballotParty: 'Libertarian', provisional: true, provisionalReason: 'Party label discrepancy in source (Libertarian vs. Green footnote) — unresolved.' },
    ],
  },
  {
    state: 'MS',
    raceName: 'Mississippi Senate 2026',
    isSpecial: false,
    sourceUrl:
      'https://en.wikipedia.org/w/index.php?title=2026_United_States_Senate_election_in_Mississippi&oldid=1382692867',
    sourceTier: 'secondary_wikipedia',
    note: 'Ty Pinkins withdrew from the Democratic primary and is running as an independent; reported ~$104K raised and 6-7% polling as of mid-October.',
    nominees: [
      { name: 'Cindy Hyde-Smith', ballotParty: 'Republican' },
      { name: 'Scott Colom', ballotParty: 'Democratic' },
      { name: 'Ty Pinkins', ballotParty: 'Independent', provisional: true, provisionalReason: 'Former Democratic primary candidate, now running independent with real fundraising/polling.' },
    ],
  },
  {
    state: 'MT',
    raceName: 'Montana Senate 2026',
    isSpecial: false,
    sourceUrl:
      'https://en.wikipedia.org/w/index.php?title=2026_United_States_Senate_election_in_Montana&oldid=1382853635',
    sourceTier: 'secondary_wikipedia',
    note: 'Steve Daines withdrew from the primary at the filing deadline and endorsed Kurt Alme, who became the GOP nominee (replacement). Seth Bodnar (independent) is treated as a serious three-way contender by the source.',
    nominees: [
      { name: 'Kurt Alme', ballotParty: 'Republican' },
      { name: 'Alani Bankhead', ballotParty: 'Democratic' },
      { name: 'Seth Bodnar', ballotParty: 'Independent', provisional: true, provisionalReason: 'Serious three-way contender per source.' },
      { name: 'Kyle Austin', ballotParty: 'Libertarian', provisional: true, provisionalReason: 'Disavowed by the Montana Libertarian Party but still on ballot.' },
    ],
  },
  {
    state: 'NC',
    raceName: 'North Carolina Senate 2026',
    isSpecial: false,
    sourceUrl:
      'https://en.wikipedia.org/w/index.php?title=2026_United_States_Senate_election_in_North_Carolina&oldid=1382844720',
    sourceTier: 'secondary_wikipedia',
    note: 'Seven declared independents are explicitly listed as "Disqualified" by the source and are excluded.',
    nominees: [
      { name: 'Michael Whatley', ballotParty: 'Republican' },
      { name: 'Roy Cooper', ballotParty: 'Democratic' },
      { name: 'Shannon W. Bray', ballotParty: 'Libertarian', provisional: true },
      { name: 'Michael Dublin', ballotParty: 'Green', provisional: true },
    ],
  },
  {
    state: 'NE',
    raceName: 'Nebraska Senate 2026',
    isSpecial: false,
    sourceUrl:
      'https://en.wikipedia.org/w/index.php?title=2026_United_States_Senate_election_in_Nebraska&oldid=1382872137',
    sourceTier: 'secondary_wikipedia',
    note: 'Democratic primary winner Cindy Burbank withdrew; a lawsuit to force a replacement nominee was dismissed, so there is no Democratic nominee. Dan Osborn (independent) is the main challenger. Mike Marvin withdrew/endorsed Osborn but remains printed on the ballot per source.',
    nominees: [
      { name: 'Pete Ricketts', ballotParty: 'Republican' },
      { name: 'Dan Osborn', ballotParty: 'Independent', provisional: true, provisionalReason: 'Main challenger to Ricketts, competitive polling.' },
      { name: 'Chuck Conboy', ballotParty: 'America First', provisional: true },
      { name: 'Robin Richards', ballotParty: 'Nebraska Working People', provisional: true },
      { name: 'Mike Marvin', ballotParty: 'Legal Marijuana NOW', provisional: true, provisionalReason: 'Withdrew/endorsed Osborn but remains on ballot per source.' },
    ],
  },
  {
    state: 'NH',
    raceName: 'New Hampshire Senate 2026',
    isSpecial: false,
    sourceUrl:
      'https://en.wikipedia.org/w/index.php?title=2026_United_States_Senate_election_in_New_Hampshire&oldid=1382572236',
    sourceTier: 'secondary_wikipedia',
    nominees: [
      { name: 'Chris Pappas', ballotParty: 'Democratic' },
      { name: 'John E. Sununu', ballotParty: 'Republican' },
      { name: 'Edmond J. LaPlante Jr.', ballotParty: 'Constitution', provisional: true },
    ],
  },
  {
    state: 'NJ',
    raceName: 'New Jersey Senate 2026',
    isSpecial: false,
    sourceUrl:
      'https://en.wikipedia.org/w/index.php?title=2026_United_States_Senate_election_in_New_Jersey&oldid=1382576782',
    sourceTier: 'secondary_wikipedia',
    note: 'Eduardo Castillo is a write-in only and is excluded per the write-in exclusion rule.',
    nominees: [
      { name: 'Cory Booker', ballotParty: 'Democratic' },
      { name: 'Justin Murphy', ballotParty: 'Republican' },
      { name: 'Veronica Fernandez', ballotParty: 'End the Corruption!', provisional: true },
      { name: 'Joanne Kuniansky', ballotParty: 'Socialist Workers', provisional: true },
    ],
  },
  {
    state: 'NM',
    raceName: 'New Mexico Senate 2026',
    isSpecial: false,
    sourceUrl:
      'https://en.wikipedia.org/w/index.php?title=2026_United_States_Senate_election_in_New_Mexico&oldid=1382578961',
    sourceTier: 'secondary_wikipedia',
    note: 'Larry Marker was nominated via write-in in the Republican primary (unusual path, but he is the confirmed general-election R nominee). Mira O\'Connell (independent) is listed as not qualifying and is excluded.',
    nominees: [
      { name: 'Ben Ray Luján', ballotParty: 'Democratic' },
      { name: 'Larry Marker', ballotParty: 'Republican' },
    ],
  },
  {
    state: 'OH',
    raceName: 'Ohio Senate special election 2026',
    isSpecial: true,
    sourceUrl:
      'https://en.wikipedia.org/w/index.php?title=2026_United_States_Senate_special_election_in_Ohio&oldid=1382827681',
    sourceTier: 'secondary_wikipedia',
    note: 'Special election for the seat JD Vance vacated; Jon Husted was appointed and is the Republican nominee. Greg Levy is reportedly a Party for Socialism and Liberation member filing as an independent — label mismatch flagged.',
    nominees: [
      { name: 'Jon Husted', ballotParty: 'Republican' },
      { name: 'Sherrod Brown', ballotParty: 'Democratic' },
      { name: 'Bill Redpath', ballotParty: 'Libertarian', provisional: true },
      { name: 'Greg Levy', ballotParty: 'Independent', provisional: true, provisionalReason: 'Reportedly a Party for Socialism and Liberation member filing as independent — label mismatch.' },
    ],
  },
  {
    state: 'OK',
    raceName: 'Oklahoma Senate 2026',
    isSpecial: false,
    sourceUrl:
      'https://en.wikipedia.org/w/index.php?title=2026_United_States_Senate_election_in_Oklahoma&oldid=1382852413',
    sourceTier: 'secondary_wikipedia',
    note: 'Ron Meinhardt and Curtis Stinnett\'s formal ballot qualification as independents was not confirmed in the fetched article text (only a results table and campaign links were visible) — flagged for your review.',
    nominees: [
      { name: 'Kevin Hern', ballotParty: 'Republican' },
      { name: "N'Kiyla Jasmine Thomas", ballotParty: 'Democratic' },
      { name: 'Sevier White', ballotParty: 'Libertarian', provisional: true },
      { name: 'Ron Meinhardt', ballotParty: 'Independent', provisional: true, provisionalReason: 'Ballot qualification not confirmed by source; former Republican, switched to independent.' },
      { name: 'Curtis Stinnett', ballotParty: 'Independent', provisional: true, provisionalReason: 'Ballot qualification not confirmed by source.' },
    ],
  },
  {
    state: 'OR',
    raceName: 'Oregon Senate 2026',
    isSpecial: false,
    sourceUrl:
      'https://en.wikipedia.org/w/index.php?title=2026_United_States_Senate_election_in_Oregon&oldid=1382605862',
    sourceTier: 'secondary_wikipedia',
    note: 'Chris Henry has a Progressive ballot line and a cross-nomination from the Pacific Green Party per source.',
    nominees: [
      { name: 'Jeff Merkley', ballotParty: 'Democratic' },
      { name: 'David Brock Smith', ballotParty: 'Republican' },
      { name: 'Gary Dye', ballotParty: 'Libertarian', provisional: true },
      { name: 'Chris Henry', ballotParty: 'Progressive', provisional: true, provisionalReason: 'Cross-nominated by the Pacific Green Party per source.' },
    ],
  },
  {
    state: 'RI',
    raceName: 'Rhode Island Senate 2026',
    isSpecial: false,
    sourceUrl:
      'https://en.wikipedia.org/w/index.php?title=2026_United_States_Senate_election_in_Rhode_Island&oldid=1382830606',
    sourceTier: 'secondary_wikipedia',
    note: 'Michael Bahry\'s formal ballot qualification was not confirmed in the fetched article text — flagged for your review.',
    nominees: [
      { name: 'Jack Reed', ballotParty: 'Democratic' },
      { name: 'Raymond McKay', ballotParty: 'Republican' },
      { name: 'Michael Bahry', ballotParty: 'Independent', provisional: true, provisionalReason: 'Ballot qualification not confirmed by source.' },
    ],
  },
  {
    state: 'SC',
    raceName: 'South Carolina Senate 2026',
    isSpecial: false,
    sourceUrl:
      'https://en.wikipedia.org/w/index.php?title=2026_United_States_Senate_election_in_South_Carolina&oldid=1382885996',
    sourceTier: 'secondary_wikipedia',
    note: 'Incumbent Lindsey Graham died in July 2026; Gov. McMaster appointed his sister Darline Graham, who then won the Republican nomination (confirmed via WRDW news: "4 candidates set for South Carolina\'s US Senate race in November" — Graham, Andrews, Whitener, Hackett — independently corroborating the Wikipedia source). I attempted the SC Election Commission\'s own site directly but could not find a fetchable certified-candidate page; the Wikipedia source plus independent news cross-check is the basis for this entry.',
    nominees: [
      { name: 'Darline Graham', ballotParty: 'Republican' },
      { name: 'Annie Andrews', ballotParty: 'Democratic' },
      { name: 'Kasie Whitener', ballotParty: 'Libertarian', provisional: true },
      { name: 'Mark Hackett', ballotParty: 'Constitution', provisional: true },
    ],
  },
  {
    state: 'SD',
    raceName: 'South Dakota Senate 2026',
    isSpecial: false,
    sourceUrl:
      'https://en.wikipedia.org/w/index.php?title=2026_United_States_Senate_election_in_South_Dakota&oldid=1382877218',
    sourceTier: 'secondary_wikipedia',
    note: 'Democratic nominee Julian Beaudion won unopposed but withdrew in August, leaving no Democratic nominee. Brian Bengs (independent, 2022 Democratic nominee) is the main challenger to Rounds.',
    nominees: [
      { name: 'Mike Rounds', ballotParty: 'Republican' },
      { name: 'Brian Bengs', ballotParty: 'Independent', provisional: true, provisionalReason: 'Main challenger to Rounds after Democratic nominee withdrew with no replacement.' },
    ],
  },
  {
    state: 'TN',
    raceName: 'Tennessee Senate 2026',
    isSpecial: false,
    sourceUrl:
      'https://en.wikipedia.org/w/index.php?title=2026_United_States_Senate_election_in_Tennessee&oldid=1382633084',
    sourceTier: 'secondary_wikipedia',
    note: 'Source lists nine additional independent filers (Chandler, Gerena, Hearn, Jones, Macon III, Matthews, Sutman Jr., Whitson, and Mixon with an inconsistent party label) with no indication of serious candidacy or campaign activity. Excluded from this list pending the real independent-expenditure check in prompt 2b — flagged in the excluded-filers table rather than included here, since nothing in the source suggests they meet the inclusion bar.',
    nominees: [
      { name: 'Bill Hagerty', ballotParty: 'Republican' },
      { name: 'Marquita Bradshaw', ballotParty: 'Democratic' },
    ],
  },
  {
    state: 'TX',
    raceName: 'Texas Senate 2026',
    isSpecial: false,
    sourceUrl:
      'https://en.wikipedia.org/w/index.php?title=2026_United_States_Senate_election_in_Texas&oldid=1382898635',
    sourceTier: 'secondary_wikipedia',
    note: 'Incumbent John Cornyn lost the Republican primary to Ken Paxton — a primary-level event, not a general-election replacement.',
    nominees: [
      { name: 'Ken Paxton', ballotParty: 'Republican' },
      { name: 'James Talarico', ballotParty: 'Democratic' },
      { name: 'Ted Brown', ballotParty: 'Libertarian', provisional: true },
    ],
  },
  {
    state: 'VA',
    raceName: 'Virginia Senate 2026',
    isSpecial: false,
    sourceUrl:
      'https://en.wikipedia.org/w/index.php?title=2026_United_States_Senate_election_in_Virginia&oldid=1382673527',
    sourceTier: 'secondary_wikipedia',
    nominees: [
      { name: 'Mark Warner', ballotParty: 'Democratic' },
      { name: 'Bert Mizusawa', ballotParty: 'Republican' },
    ],
  },
  {
    state: 'WV',
    raceName: 'West Virginia Senate 2026',
    isSpecial: false,
    sourceUrl:
      'https://en.wikipedia.org/w/index.php?title=2026_United_States_Senate_election_in_West_Virginia&oldid=1382667996',
    sourceTier: 'secondary_wikipedia',
    nominees: [
      { name: 'Shelley Moore Capito', ballotParty: 'Republican' },
      { name: 'Rachel Fetty Anderson', ballotParty: 'Democratic' },
      { name: 'S. Marshall Wilson', ballotParty: 'Constitution', provisional: true },
    ],
  },
  {
    state: 'WY',
    raceName: 'Wyoming Senate 2026',
    isSpecial: false,
    sourceUrl:
      'https://en.wikipedia.org/w/index.php?title=2026_United_States_Senate_election_in_Wyoming&oldid=1382679528',
    sourceTier: 'secondary_wikipedia',
    nominees: [
      { name: 'Harriet Hageman', ballotParty: 'Republican' },
      { name: 'James W. Byrd', ballotParty: 'Democratic' },
    ],
  },
]
