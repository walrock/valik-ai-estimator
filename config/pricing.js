export const pricing = {
  minimum_order: 1000,

  painting: {
    project_design: { unit: "m2", price: 250 },
    preparation: { unit: "m2", price: 10 },
    putty_2_layers: { unit: "m2", price: 45 },
    priming: { unit: "m2", price: 10 },
    primer_paint: { unit: "m2", price: 15 },
    paint_2_layers: { unit: "m2", price: 25 },
    wallpaper_install: { unit: "m2", price: 80 },
    wallpaper_remove: { unit: "m2", price: 20 },
  },

  drywall: {
    ceiling: { unit: "m2", price: 120 },
    wall_frame: { unit: "m2", price: 70 },
    wall_glue: { unit: "m2", price: 90 },
    partition_1_layer: { unit: "m2", price: 130 },
    partition_2_layer: { unit: "m2", price: 150 },
  },

  tiling: {
    demolition_with_lift: { unit: "m2", price: 40 },
    demolition_no_lift: { unit: "m2", price: 65 },
    leveling: { unit: "m2", price: 40 },
    tile_10_15: { unit: "m2", price: 175 },
    tile_30_60: { unit: "m2", price: 140 },
    tile_60_120: { unit: "m2", price: 175 },
    mosaic: { unit: "m2", price: 250 },
    stone: { unit: "m2", price: 175 },
    waterproofing: { unit: "m2", price: 40 },
  },

  flooring: {
    laminate: { unit: "m2", price: 60 },
    parquet_glue: { unit: "m2", price: 100 },
    parquet_click: { unit: "m2", price: 80 },
    carpet: { unit: "m2", price: 50 },
  },

  plumbing: {
    water_point: { unit: "pcs", price: 600 },
    heating_point: { unit: "pcs", price: 300 },
    toilet_install: { unit: "pcs", price: 250 },
    shower_install: { unit: "pcs", price: 300 },
  },

  electrical: {
    electric_point: { unit: "pcs", price: 140 },
    socket_install: { unit: "pcs", price: 30 },
    light_install: { unit: "pcs", price: 60 },
  },
};
