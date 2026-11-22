// Extend a record with a verified address, directionsUrl, phone, or email when available.
export const branches = [
  {
    slug: 'indiranagar',
    name: 'Indiranagar',
    area: '12th Main',
    hours: '8:00 AM – 11:00 PM',
    copy: 'A leafy room for slow breakfasts and late suppers.',
    image: '/images/editorial/room.webp',
    imageAlt: 'A café dining room in warm light',
  },
  {
    slug: 'koramangala',
    name: 'Koramangala',
    area: '5th Block',
    hours: '8:00 AM – 11:00 PM',
    copy: 'Coffee, kitchen and convivial tables in the heart of the neighbourhood.',
    image: '/images/editorial/koramangala.webp',
    imageAlt: 'Illustrative leafy courtyard café with timber furniture',
  },
  {
    slug: 'whitefield',
    name: 'Whitefield',
    area: 'ITPL Road',
    hours: '8:00 AM – 10:30 PM',
    copy: 'An all-day pause between the city and the garden.',
    image: '/images/editorial/whitefield.webp',
    imageAlt: 'Illustrative sunlit conservatory café with rattan chairs',
  },
];

export function findBranch(slug) {
  return branches.find(branch => branch.slug === slug);
}
