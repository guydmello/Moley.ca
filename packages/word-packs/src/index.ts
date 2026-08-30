export type WordEntry = {
  id: string;
  display: string;
  aliases?: string[];
  category: string;
  difficulty: 'easy' | 'medium' | 'hard';
  tags: string[];
  safeBotClues: string[];
  botClues?: {
    direct: string[];
    medium: string[];
    subtle: string[];
  };
  relatedConcepts?: string[];
  botEnabled?: boolean;
  familySafe: boolean;
  contentLevel?: 'family' | 'teen';
  pack?: string;
  lastReviewed?: string;
};

type BotMetadata = Required<Pick<WordEntry, 'botClues' | 'relatedConcepts'>>;

const BOT_METADATA: Record<string, BotMetadata> = {
  Apple: { botClues: { direct: ['fruit', 'orchard', 'core'], medium: ['cider', 'pie', 'lunchbox', 'crisp'], subtle: ['Newton', 'teacher', 'harvest'] }, relatedConcepts: ['tree', 'red', 'green', 'snack'] },
  Hockey: { botClues: { direct: ['puck', 'rink', 'goalie'], medium: ['ice', 'stick', 'penalty', 'Zamboni'], subtle: ['Canada', 'power play', 'faceoff'] }, relatedConcepts: ['sport', 'winter', 'skates', 'arena'] },
  Paris: { botClues: { direct: ['France', 'Eiffel', 'capital'], medium: ['Seine', 'croissant', 'Louvre', 'metro'], subtle: ['fashion', 'arrondissement', 'lights'] }, relatedConcepts: ['city', 'Europe', 'landmark', 'French'] },
  Penguin: { botClues: { direct: ['Antarctica', 'bird', 'waddles'], medium: ['tuxedo', 'colony', 'ice', 'flightless'], subtle: ['emperor', 'black-and-white', 'rookery'] }, relatedConcepts: ['animal', 'cold', 'ocean', 'feathers'] },
  Hammer: { botClues: { direct: ['nail', 'tool', 'strike'], medium: ['carpenter', 'handle', 'workbench', 'claw'], subtle: ['gavel', 'forge', 'Thor'] }, relatedConcepts: ['build', 'metal', 'repair', 'workshop'] },
  'Eiffel Tower': { botClues: { direct: ['Paris', 'France', 'landmark'], medium: ['iron', 'skyline', 'monument', 'Gustave'], subtle: ['exposition', 'lattice', 'Champ de Mars'] }, relatedConcepts: ['tower', 'Europe', 'travel', 'architecture'] },
  Pizza: { botClues: { direct: ['slice', 'cheese', 'pepperoni'], medium: ['oven', 'crust', 'delivery', 'toppings'], subtle: ['Naples', 'triangle', 'pizzeria'] }, relatedConcepts: ['food', 'Italian', 'dinner', 'tomato'] },
  Dog: { botClues: { direct: ['fetch', 'bark', 'puppy', 'leash'], medium: ['companion', 'kennel', 'loyal', 'walk', 'collar'], subtle: ['park', 'rescue', 'groomer', 'household', 'four-legged'] }, relatedConcepts: ['pet', 'animal', 'paws'] },
  Canada: { botClues: { direct: ['maple', 'Ottawa', 'provinces'], medium: ['hockey', 'toque', 'loonie', 'north'], subtle: ['mosaic', 'Dominion', 'red-and-white'] }, relatedConcepts: ['country', 'flag', 'winter', 'Toronto'] },
  Guitar: { botClues: { direct: ['strings', 'instrument', 'strum'], medium: ['frets', 'chord', 'amp', 'acoustic'], subtle: ['riff', 'pick', 'six'] }, relatedConcepts: ['music', 'band', 'melody', 'concert'] },
  Moon: { botClues: { direct: ['night', 'lunar', 'crater'], medium: ['orbit', 'tides', 'crescent', 'eclipse'], subtle: ['Apollo', 'waxing', 'satellite'] }, relatedConcepts: ['space', 'Earth', 'sky', 'astronaut'] },
  Coffee: { botClues: { direct: ['caffeine', 'mug', 'beans'], medium: ['roast', 'morning', 'espresso', 'brew'], subtle: ['aroma', 'barista', 'grind'] }, relatedConcepts: ['drink', 'cafe', 'hot', 'breakfast'] },
  Car: { botClues: { direct: ['drive', 'wheels', 'engine'], medium: ['traffic', 'garage', 'seatbelt', 'highway'], subtle: ['odometer', 'commute', 'ignition'] }, relatedConcepts: ['vehicle', 'road', 'transport', 'fuel'] },
  Book: { botClues: { direct: ['read', 'pages', 'author'], medium: ['library', 'chapter', 'cover', 'story'], subtle: ['spine', 'bookmark', 'edition'] }, relatedConcepts: ['literature', 'paper', 'novel', 'words'] },
  Beach: { botClues: { direct: ['sand', 'ocean', 'waves'], medium: ['sunscreen', 'towel', 'shore', 'shells'], subtle: ['tide', 'boardwalk', 'dunes'] }, relatedConcepts: ['summer', 'water', 'vacation', 'coast'] },
  Rainbow: { botClues: { direct: ['colours', 'rain', 'arc'], medium: ['prism', 'spectrum', 'sunlight', 'sky'], subtle: ['refraction', 'pot of gold', 'seven'] }, relatedConcepts: ['weather', 'light', 'clouds', 'bright'] }
};

const PACKS: Record<string, string> = {
  Fruits: 'Apple|Banana|Cherry|Date|Fig|Grape|Orange|Pear|Watermelon|Strawberry|Kiwi|Peach|Mango|Pineapple|Blueberry|Raspberry',
  Vegetables: 'Carrot|Broccoli|Spinach|Potato|Onion|Pepper|Cucumber|Lettuce|Celery|Cabbage|Asparagus|Cauliflower|Radish|Turnip|Zucchini',
  Food: 'Pizza|Sushi|Taco|Pasta|Curry|Sandwich|Soup|Salad|Burger|Lasagna|Dumpling|Kebab|Steak|Pancake|Omelette',
  'Fast Food': 'French Fries|Chicken Nuggets|Hot Dog|Milkshake|Onion Rings|Burrito|Donut|Soft Pretzel|Poutine|Fried Chicken|Submarine Sandwich|Mozzarella Sticks|Nachos|Chicken Wings',
  Candy: 'Gummy Bears|Lollipop|Chocolate Bar|Jelly Beans|Licorice|Caramel|Cotton Candy|Gumdrop|Toffee|Marshmallow|Candy Cane|Sour Candy|Fudge|Taffy',
  Snacks: 'Popcorn|Potato Chips|Pretzels|Trail Mix|Crackers|Granola Bar|Cheese Puffs|Rice Cakes|Cookies|Peanuts|Beef Jerky|Fruit Snacks|Tortilla Chips|Sunflower Seeds',
  Desserts: 'Ice Cream|Cheesecake|Brownie|Cupcake|Apple Pie|Tiramisu|Pudding|Macaron|Waffle|Churro|Crème Brûlée|Lemon Tart|Cinnamon Roll|Shortbread',
  Beverages: 'Coffee|Tea|Lemonade|Hot Chocolate|Orange Juice|Smoothie|Cola|Milk|Sparkling Water|Iced Tea|Milkshake|Root Beer|Apple Cider|Espresso',
  Animals: 'Lion|Tiger|Bear|Elephant|Giraffe|Zebra|Kangaroo|Panda|Wolf|Fox|Rabbit|Deer|Gorilla|Rhinoceros|Hippopotamus|Sloth|Otter|Raccoon',
  Pets: 'Dog|Cat|Hamster|Goldfish|Parrot|Guinea Pig|Rabbit|Budgie|Ferret|Turtle|Gecko|Chinchilla|Canary|Hermit Crab',
  Birds: 'Eagle|Owl|Penguin|Flamingo|Peacock|Swan|Robin|Crow|Seagull|Hummingbird|Woodpecker|Pelican|Toucan|Ostrich|Blue Jay',
  Insects: 'Butterfly|Bee|Ant|Mosquito|Dragonfly|Ladybug|Grasshopper|Beetle|Moth|Firefly|Praying Mantis|Cicada|Wasp|Cricket',
  'Sea Creatures': 'Dolphin|Shark|Octopus|Whale|Jellyfish|Seahorse|Starfish|Crab|Lobster|Seal|Stingray|Swordfish|Sea Turtle|Orca|Squid',
  Dinosaurs: 'Tyrannosaurus|Triceratops|Stegosaurus|Velociraptor|Brachiosaurus|Ankylosaurus|Spinosaurus|Pterodactyl|Diplodocus|Iguanodon|Allosaurus|Parasaurolophus',
  Countries: 'Canada|Brazil|France|Germany|Australia|Japan|India|China|Italy|Mexico|Spain|Egypt|Norway|Argentina|Thailand|New Zealand|Kenya|Portugal',
  Cities: 'Toronto|Paris|Tokyo|London|New York|Sydney|Rome|Cairo|Vancouver|Berlin|Mumbai|Barcelona|Seoul|Amsterdam|Dubai|Montreal|Chicago|Singapore',
  Continents: 'Africa|Antarctica|Asia|Europe|North America|South America|Australia',
  Geography: 'Mountain|River|Island|Desert|Valley|Volcano|Glacier|Waterfall|Canyon|Peninsula|Lake|Forest|Cave|Beach|Cliff',
  Landmarks: 'Eiffel Tower|Great Wall of China|Statue of Liberty|Colosseum|Taj Mahal|Machu Picchu|Pyramids of Giza|Big Ben|Sydney Opera House|Mount Rushmore|Christ the Redeemer|Stonehenge|Golden Gate Bridge|CN Tower|Niagara Falls',
  Canada: 'Maple Syrup|Hockey|Toque|Loonie|Mountie|Canoe|Poutine|Beaver|Inukshuk|Snowshoe|Timbits|Nanaimo Bar|Lacrosse|Northern Lights|Cottage|Two-Four|Caesar|Butter Tart|Ketchup Chips|Coffee Crisp|Donair|Cabane à Sucre|Zamboni|Eh|The Tragically Hip|Bagged Milk|Algonquin Park|CN Tower|Rideau Canal',
  'Modes of Transport': 'Bicycle|Car|Train|Airplane|Boat|Subway|Bus|Helicopter|Motorcycle|Scooter|Tram|Ferry|Skateboard|Taxi|Hot Air Balloon',
  Cars: 'Sedan|Convertible|Minivan|Pickup Truck|Sports Car|Limousine|Hatchback|Jeep|Electric Car|Station Wagon|Race Car|Monster Truck|Ambulance|School Bus',
  Travel: 'Passport|Suitcase|Boarding Pass|Hotel|Map|Itinerary|Tour Guide|Backpack|Hostel|Souvenir|Jet Lag|Airport|Cruise|Road Trip',
  Vacation: 'Resort|Camping|Beach|Cabin|Theme Park|Safari|Ski Trip|Staycation|Road Trip|Cruise|Sightseeing|Hiking|Snorkelling|Postcard',
  Sports: 'Soccer|Basketball|Baseball|Tennis|Cricket|Hockey|Golf|Boxing|Rugby|Swimming|Cycling|Skiing|Volleyball|Curling|Skateboarding|Gymnastics',
  'Winter Sports': 'Snowboarding|Skiing|Curling|Bobsled|Luge|Figure Skating|Speed Skating|Ice Hockey|Skeleton|Ski Jumping|Biathlon|Snowshoeing',
  Games: 'Hide and Seek|Tag|Charades|Hopscotch|Capture the Flag|Dodgeball|Trivia|Pictionary|Twenty Questions|Telephone|I Spy|Simon Says|Rock Paper Scissors|Scavenger Hunt',
  'Board Games': 'Monopoly|Chess|Checkers|Scrabble|Clue|Risk|Catan|Candy Land|Sorry|The Game of Life|Battleship|Jenga|Ticket to Ride|Connect Four|Yahtzee',
  'Video Games': 'Minecraft|Tetris|Fortnite|Mario Kart|The Legend of Zelda|Pokémon|Animal Crossing|Rocket League|Pac-Man|Sonic|Among Us|Portal|Overwatch|Stardew Valley|Roblox',
  Toys: 'Teddy Bear|Yo-Yo|Building Blocks|Kite|Doll|Action Figure|Puzzle|Toy Train|Hula Hoop|Water Gun|Rubber Duck|Frisbee|Slinky|Marbles|Play-Doh',
  Hobbies: 'Painting|Gardening|Knitting|Photography|Fishing|Cooking|Reading|Hiking|Pottery|Woodworking|Birdwatching|Collecting|Baking|Origami|Calligraphy',
  Party: 'Balloon|Confetti|Cake|Invitation|Dance Floor|Party Hat|Streamer|Piñata|DJ|Photo Booth|Gift Bag|Candle|Toast|Surprise',
  Movies: 'Inception|Titanic|Avatar|Gladiator|Joker|Interstellar|Frozen|Coco|Up|Braveheart|Rocky|The Matrix|Toy Story|Jurassic Park|Finding Nemo',
  'TV Shows': 'Friends|The Office|Stranger Things|The Simpsons|Bluey|Seinfeld|Survivor|Jeopardy|Wednesday|The Crown|Ted Lasso|The Mandalorian|Sherlock|Doctor Who',
  'Famous Characters': 'Sherlock Holmes|Harry Potter|Darth Vader|Cinderella|James Bond|Peter Pan|Indiana Jones|Wonder Woman|Winnie the Pooh|Mary Poppins|Robin Hood|Katniss Everdeen|Shrek|Paddington',
  Superheroes: 'Superman|Batman|Spider-Man|Wonder Woman|Black Panther|Iron Man|Captain Marvel|The Flash|Hulk|Aquaman|Thor|Wolverine|Green Lantern|Black Widow',
  'Fairy Tales': 'Cinderella|Snow White|Rapunzel|Little Red Riding Hood|Sleeping Beauty|Hansel and Gretel|Jack and the Beanstalk|The Ugly Duckling|Rumpelstiltskin|Puss in Boots|The Frog Prince|Goldilocks',
  'Mythical Creatures': 'Dragon|Unicorn|Phoenix|Mermaid|Centaur|Griffin|Minotaur|Cyclops|Kraken|Pegasus|Yeti|Werewolf|Sphinx|Fairy',
  'Mythological Gods': 'Zeus|Athena|Poseidon|Apollo|Aphrodite|Thor|Odin|Loki|Anubis|Ra|Hera|Hermes|Artemis|Hades',
  Music: 'Melody|Rhythm|Harmony|Chorus|Concert|Album|Playlist|Microphone|Headphones|Singer|Band|Orchestra|Encore|Tempo|Vinyl Record',
  Instruments: 'Guitar|Piano|Violin|Drums|Trumpet|Flute|Saxophone|Cello|Harp|Clarinet|Trombone|Ukulele|Accordion|Banjo|Xylophone',
  'Dance Styles': 'Ballet|Salsa|Hip-Hop|Tango|Waltz|Breakdancing|Tap Dance|Jazz|Swing|Flamenco|Ballroom|Contemporary|Line Dance|Disco',
  Technology: 'Smartphone|Laptop|Robot|Wi-Fi|Bluetooth|Keyboard|Touchscreen|Battery|Charger|Drone|Virtual Reality|Cloud Storage|Password|Webcam|Printer',
  'Internet Culture': 'Meme|Viral Video|Livestream|Podcast|Hashtag|Emoji|Selfie|GIF|Influencer|Unboxing|Reaction Video|Clickbait|Avatar|Trending',
  'Social Media': 'Post|Story|Comment|Follower|Like|Share|Feed|Filter|Direct Message|Notification|Profile|Reel|Livestream|Hashtag',
  Science: 'Microscope|Telescope|Experiment|Gravity|Atom|Cell|DNA|Energy|Magnet|Fossil|Laboratory|Equation|Molecule|Evolution|Ecosystem',
  Planets: 'Mercury|Venus|Earth|Mars|Jupiter|Saturn|Uranus|Neptune',
  Space: 'Astronaut|Rocket|Galaxy|Comet|Asteroid|Moon|Satellite|Space Station|Black Hole|Nebula|Orbit|Meteor|Constellation|Solar Eclipse|Spacesuit',
  'Space Objects': 'Star|Planet|Moon|Comet|Asteroid|Meteorite|Galaxy|Nebula|Black Hole|Pulsar|Quasar|Satellite|Constellation|Dwarf Planet',
  Elements: 'Hydrogen|Helium|Carbon|Oxygen|Iron|Gold|Silver|Copper|Neon|Calcium|Sodium|Silicon|Nitrogen|Mercury|Uranium',
  Materials: 'Wood|Glass|Steel|Plastic|Cotton|Leather|Rubber|Concrete|Silk|Wool|Paper|Ceramic|Aluminum|Velvet|Marble',
  Weather: 'Rain|Snow|Thunderstorm|Tornado|Hurricane|Fog|Rainbow|Hail|Wind|Heatwave|Blizzard|Lightning|Cloud|Sunshine|Drizzle',
  Nature: 'Tree|Flower|Mushroom|Moss|Pond|Meadow|Mountain|River|Sunset|Ocean|Rainforest|Coral Reef|Prairie|Boulder|Waterfall',
  Trees: 'Maple|Oak|Pine|Birch|Willow|Cedar|Redwood|Palm|Spruce|Apple Tree|Cherry Tree|Banyan|Aspen|Baobab|Eucalyptus',
  Flowers: 'Rose|Tulip|Daisy|Sunflower|Lily|Orchid|Daffodil|Lavender|Peony|Carnation|Poppy|Iris|Marigold|Chrysanthemum',
  Gemstones: 'Diamond|Ruby|Emerald|Sapphire|Amethyst|Opal|Topaz|Garnet|Aquamarine|Jade|Onyx|Turquoise|Pearl|Quartz',
  Jewelry: 'Ring|Necklace|Bracelet|Earrings|Brooch|Pendant|Tiara|Cufflinks|Locket|Anklet|Charm|Watch|Chain|Gemstone',
  Clothing: 'T-Shirt|Jeans|Sweater|Jacket|Dress|Shorts|Scarf|Gloves|Socks|Raincoat|Hoodie|Suit|Skirt|Pyjamas|Overalls',
  Shoes: 'Sneakers|Boots|Sandals|Slippers|High Heels|Flip-Flops|Loafers|Skates|Cleats|Hiking Boots|Running Shoes|Clogs|Ballet Shoes|Rain Boots',
  'Body Parts': 'Elbow|Knee|Shoulder|Ankle|Thumb|Eyebrow|Chin|Spine|Wrist|Tongue|Heel|Forehead|Palm|Lung|Heart',
  Emotions: 'Happy|Sad|Angry|Nervous|Excited|Calm|Jealous|Proud|Confused|Surprised|Embarrassed|Grateful|Lonely|Curious|Hopeful',
  Actions: 'Jumping|Whispering|Running|Dancing|Laughing|Sneezing|Clapping|Waving|Crawling|Stretching|Yawning|Pointing|Spinning|Balancing|Hiding',
  Places: 'Library|Hospital|Airport|Museum|Beach|School|Restaurant|Park|Cinema|Farm|Bakery|Stadium|Aquarium|Market|Post Office',
  Restaurants: 'Menu|Waiter|Kitchen|Reservation|Tip|Appetizer|Entrée|Dessert|Buffet|Takeout|Booth|Chef|Napkin|Bill|Special',
  School: 'Teacher|Homework|Recess|Backpack|Pencil|Classroom|Principal|Textbook|Locker|Cafeteria|Gymnasium|School Bus|Field Trip|Report Card|Whiteboard',
  Office: 'Meeting|Deadline|Stapler|Printer|Desk|Coffee Break|Spreadsheet|Presentation|Conference Room|Calendar|Email|Photocopier|Name Tag|Water Cooler|Briefcase',
  Jobs: 'Doctor|Teacher|Firefighter|Chef|Carpenter|Pilot|Nurse|Electrician|Farmer|Lawyer|Mechanic|Photographer|Architect|Journalist|Veterinarian',
  'Household Objects': 'Lamp|Mirror|Clock|Vacuum|Doorbell|Couch|Blanket|Broom|Laundry Basket|Curtain|Doormat|Remote Control|Bookshelf|Coat Hanger|Iron',
  Furniture: 'Chair|Table|Sofa|Bed|Desk|Dresser|Stool|Wardrobe|Bench|Bookshelf|Nightstand|Ottoman|Cabinet|Rocking Chair',
  'Kitchen Appliances': 'Refrigerator|Oven|Microwave|Toaster|Blender|Dishwasher|Kettle|Coffee Maker|Air Fryer|Stand Mixer|Slow Cooker|Rice Cooker|Freezer|Food Processor',
  Tools: 'Hammer|Screwdriver|Wrench|Pliers|Saw|Drill|Tape Measure|Level|Chisel|Ladder|Paintbrush|Flashlight|Shovel|Clamp|Toolbox',
  Shapes: 'Circle|Square|Triangle|Rectangle|Oval|Star|Hexagon|Cube|Sphere|Cone|Cylinder|Diamond|Pentagon|Octagon|Crescent',
  Colours: 'Red|Blue|Green|Yellow|Purple|Orange|Pink|Brown|Black|White|Turquoise|Gold|Silver|Navy|Coral',
  Holidays: 'Christmas|Halloween|Thanksgiving|Easter|New Year|Valentine’s Day|Diwali|Hanukkah|Lunar New Year|Canada Day|St. Patrick’s Day|Mother’s Day|Father’s Day|April Fools’ Day',
  Winter: 'Snowman|Mittens|Sled|Fireplace|Snowflake|Icicle|Hot Chocolate|Scarf|Skating|Blizzard|Toque|Snow Fort|Ski Lift|Frost',
  Summer: 'Sunscreen|Beach Ball|Popsicle|Sandcastle|Picnic|Hammock|Barbecue|Swimming Pool|Flip-Flops|Watermelon|Camping|Fireflies|Sunhat|Lemonade',
  Childhood: 'Playground|Bedtime Story|Treehouse|Lunchbox|Blanket Fort|Hide and Seek|Crayon|Sticker|Sleepover|Training Wheels|Swing Set|Cartoon|School Photo|Piggy Bank',
  Brands: 'LEGO|Nike|Apple|Toyota|Netflix|Disney|IKEA|Samsung|Coca-Cola|Adidas|Nintendo|Google|Lululemon|Spotify',
  'Historical Figures': 'Cleopatra|Albert Einstein|Leonardo da Vinci|Marie Curie|Nelson Mandela|Amelia Earhart|William Shakespeare|Rosa Parks|Galileo|Harriet Tubman|Abraham Lincoln|Joan of Arc|Genghis Khan|Florence Nightingale',
  'Famous People': 'Beyoncé|Taylor Swift|Dwayne Johnson|Oprah Winfrey|Lionel Messi|Serena Williams|Keanu Reeves|Adele|Tom Hanks|Rihanna|LeBron James|Céline Dion|Jackie Chan|Shah Rukh Khan'
};

const CATEGORY_CLUES: Record<string, string[]> = {
  Fruits: ['sweet', 'market', 'fresh'], Vegetables: ['garden', 'crunchy', 'produce'],
  Animals: ['wild', 'habitat', 'creature'], Pets: ['companion', 'home', 'friendly'],
  Countries: ['flag', 'border', 'travel'], Cities: ['streets', 'downtown', 'map'],
  Sports: ['competition', 'team', 'practice'], Music: ['sound', 'rhythm', 'listen'],
  Technology: ['modern', 'device', 'connected'], Space: ['distant', 'orbit', 'night'],
  Weather: ['forecast', 'outside', 'sky'], Food: ['meal', 'tasty', 'kitchen']
};

const slug = (value: string) => value.toLocaleLowerCase('en-CA').normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

export const words: WordEntry[] = Object.entries(PACKS).flatMap(([category, values]) =>
  values.split('|').map((display, index) => {
    const metadata = category === 'Brands' && display === 'Apple' ? undefined : BOT_METADATA[display];
    return ({
    id: `${slug(category)}-${slug(display)}`,
    display,
    category,
    difficulty: index % 7 === 0 ? 'hard' : index % 3 === 0 ? 'medium' : 'easy',
    tags: [slug(category), ...display.toLocaleLowerCase('en-CA').split(/\s+/).filter((part) => part.length > 3)],
    safeBotClues: metadata ? [...metadata.botClues.direct, ...metadata.botClues.medium, ...metadata.botClues.subtle] : (CATEGORY_CLUES[category] ?? [category.toLocaleLowerCase('en-CA')]),
    botClues: metadata?.botClues,
    relatedConcepts: metadata?.relatedConcepts,
    botEnabled: Boolean(metadata),
    familySafe: true,
    contentLevel: 'family' as const,
    pack: category === 'Internet Culture' ? 'internet-culture-2026' : category === 'Canada' ? 'canada-expanded' : 'core',
    lastReviewed: category === 'Internet Culture' ? '2026-08-23' : undefined
    });
  })
);

export const categories = Object.entries(PACKS).map(([name, values]) => ({
  name,
  count: values.split('|').length,
  difficulty: 'mixed' as const
}));

export function pickWord(selected: string[], recentlyUsed: string[], random: () => number = Math.random): WordEntry {
  const allowedCategories = selected.length ? new Set(selected) : null;
  const pool = words.filter((word) => (!allowedCategories || allowedCategories.has(word.category)) && !recentlyUsed.includes(word.id));
  const fallback = words.filter((word) => !allowedCategories || allowedCategories.has(word.category));
  const candidates = pool.length ? pool : fallback.length ? fallback : words;
  return candidates[Math.floor(random() * candidates.length)]!;
}

export const WORD_COUNT = words.length;
export const botSupportedWords = words.filter((word) => word.botEnabled);
