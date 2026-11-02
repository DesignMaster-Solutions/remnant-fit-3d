// Five jobs. The counter shape of each one is read from its Lux3D kitchen mesh at load time; what is
// written here is only the brief: which kitchen, how long its longest run is, and what is in the yard.
// Stock entries are [model, longest side in metres]; the same scan at two sizes is how yards really look.
// Ordered by how well the foreman does (test/levels.test.js prints it): 84, 82, 74, 70, 69.
export const LEVELS = [
  {
    kitchen: 'kitchen-run', run: 2.4, title: 'Straight run', client: 'A rental flat. One run, three offcuts, no fuss.',
    stock: [['remnant-e', 1.4], ['remnant-c', 1.1], ['remnant-a', 1.2]],
  },
  {
    kitchen: 'kitchen-galley', run: 3.0, title: 'Galley', client: 'Two runs and a sink. Long thin pieces pay off here.',
    stock: [['remnant-e', 2.2], ['remnant-e', 1.8], ['remnant-f', 1.3], ['remnant-azul', 1.1], ['remnant-c', 1.0], ['remnant-e', 1.0]],
  },
  {
    kitchen: 'kitchen-u', run: 3.2, title: 'U-shape', client: 'Three runs and a sink. Every corner is a seam or a saw cut.',
    stock: [['remnant-b', 2.4], ['remnant-e', 2.2], ['remnant-rosa', 1.4], ['remnant-f', 1.3], ['remnant-d', 1.1], ['remnant-c', 1.0]],
  },
  {
    kitchen: 'kitchen', run: 3.2, title: 'L with a sink', client: 'The corner joint and the sink hole decide everything.',
    stock: [['remnant-a', 1.7], ['remnant-b', 2.1], ['remnant-c', 1.3], ['remnant-a', 1.2], ['remnant-c', 0.9]],
  },
  {
    kitchen: 'kitchen-island', run: 2.6, title: 'Island with a cooktop', client: 'Everyone sees an island. Few seams, please.',
    stock: [['remnant-azul', 1.9], ['remnant-rosa', 1.8], ['remnant-f', 1.5], ['remnant-d', 1.4], ['remnant-e', 1.3]],
  },
];

export const NAMES = {
  'remnant-a': 'Calacatta marble', 'remnant-b': 'Absolute black granite', 'remnant-c': 'Travertine',
  'remnant-d': 'Verde quartzite', 'remnant-e': 'Terrazzo', 'remnant-f': 'Emperador marble',
  'remnant-azul': 'Azul Bahia granite', 'remnant-rosa': 'Rosa Portogallo granite',
};
