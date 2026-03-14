const state = {
  sessionId: null,
  status: "active",
  lastEstimate: null,
  language: "pl",
};

const LOCALES = Object.freeze({
  pl: "pl-PL",
  en: "en-US",
  ru: "ru-RU",
});

const LANGUAGE_PACKS = Object.freeze({
  pl: Object.freeze({
    statusLabel: "Status",
    status: Object.freeze({
      active: "aktywna",
      needs_clarification: "wymaga doprecyzowania",
      ready_for_confirmation: "gotowa do potwierdzenia",
      confirmed: "potwierdzona",
    }),
    estimateLabel: "Wycena",
    estimateTotalLabel: "Do zaplaty",
    estimateNotReady: "pojawi sie po uzupelnieniu kluczowych informacji",
    warningsLabel: "Uwagi",
    sendLabel: "Wyslij",
    confirmLabel: "Potwierdz wycene",
    newChatLabel: "Nowa wycena",
    placeholder:
      "Np. Lazienka 6m2, skucie starych plytek, plytki 60x60...",
    crmTitle: "CRM DTO (podglad)",
    crmPreviewTitle: "CRM DTO",
    crmAvailableAfter: "dostepne po potwierdzeniu",
    crmFields: Object.freeze({
      sessionId: "sessionId",
      city: "miasto",
      contact: "kontakt",
      note: "notatka",
      total: "lacznie",
      delivery: "dostawa",
    }),
    deliveryStatus: Object.freeze({
      sent: "wyslane",
      pending: "w kolejce",
      failed: "blad",
      not_configured: "brak konfiguracji",
      unknown: "nieznane",
    }),
    unitLabels: Object.freeze({
      m2: "m2",
      pcs: "szt",
      order: "zlecenie",
    }),
    workLabels: Object.freeze({
      project_design: "projekt i pomiar",
      preparation: "przygotowanie powierzchni",
      putty_2_layers: "szpachlowanie, 2 warstwy",
      priming: "gruntowanie",
      primer_paint: "gruntowanie z malowaniem",
      paint_2_layers: "malowanie, 2 warstwy",
      wallpaper_install: "tapetowanie",
      wallpaper_remove: "usuniecie tapety",
      ceiling: "sufit podwieszany GK",
      wall_frame: "stelaz pod sciane GK",
      wall_glue: "klejenie plyt GK",
      partition_1_layer: "scianka GK, 1 warstwa",
      partition_2_layer: "scianka GK, 2 warstwy",
      demolition_with_lift: "demontaz plytek, budynek z winda",
      demolition_no_lift: "demontaz plytek, bez windy",
      leveling: "wyrownanie podloza pod plytki",
      tile_10_15: "ukladanie plytek 10x15",
      tile_30_60: "ukladanie plytek 30x60",
      tile_60_120: "ukladanie plytek 60x120",
      mosaic: "ukladanie mozaiki",
      stone: "ukladanie kamienia",
      waterproofing: "hydroizolacja",
      laminate: "ukladanie paneli",
      parquet_glue: "parkiet klejony",
      parquet_click: "parkiet na klik",
      carpet: "ukladanie wykladziny",
      water_point: "punkt wodny",
      heating_point: "punkt grzewczy",
      toilet_install: "montaz WC",
      shower_install: "montaz prysznica",
      electric_point: "punkt elektryczny",
      socket_install: "montaz gniazdka",
      light_install: "montaz oswietlenia",
    }),
    confirmCopy: Object.freeze({
      default: "Wycena zostala potwierdzona i jest gotowa do przekazania opiekunowi.",
      sent: "Wycena zostala potwierdzona i wyslana do CRM/opiekuna.",
      pending:
        "Wycena zostala potwierdzona. Wysylka do CRM jest w kolejce i bedzie ponawiana automatycznie.",
      failed:
        "Wycena zostala potwierdzona, ale wysylka do CRM nie powiodla sie. System bedzie ponawial probe.",
      not_configured:
        "Wycena zostala potwierdzona, ale CRM_WEBHOOK_URL nie jest skonfigurowany.",
    }),
    errorPrefix: "Blad",
    confirmErrorPrefix: "Blad potwierdzenia",
    noneLabel: "brak",
  }),
  en: Object.freeze({
    statusLabel: "Status",
    status: Object.freeze({
      active: "active",
      needs_clarification: "needs clarification",
      ready_for_confirmation: "ready to confirm",
      confirmed: "confirmed",
    }),
    estimateLabel: "Estimate",
    estimateTotalLabel: "Total",
    estimateNotReady: "will appear after key details are provided",
    warningsLabel: "Notes",
    sendLabel: "Send",
    confirmLabel: "Confirm estimate",
    newChatLabel: "New estimate",
    placeholder:
      "Example: Bathroom 6m2, remove old tiles, tile 60x60...",
    crmTitle: "CRM DTO (preview)",
    crmPreviewTitle: "CRM DTO",
    crmAvailableAfter: "available after confirmation",
    crmFields: Object.freeze({
      sessionId: "sessionId",
      city: "city",
      contact: "contact",
      note: "note",
      total: "total",
      delivery: "delivery",
    }),
    deliveryStatus: Object.freeze({
      sent: "sent",
      pending: "queued",
      failed: "failed",
      not_configured: "not configured",
      unknown: "unknown",
    }),
    unitLabels: Object.freeze({
      m2: "m2",
      pcs: "pcs",
      order: "order",
    }),
    workLabels: Object.freeze({
      project_design: "project planning and measurement",
      preparation: "surface preparation",
      putty_2_layers: "putty, 2 coats",
      priming: "priming",
      primer_paint: "priming with painting",
      paint_2_layers: "painting, 2 coats",
      wallpaper_install: "wallpaper installation",
      wallpaper_remove: "wallpaper removal",
      ceiling: "drywall suspended ceiling",
      wall_frame: "drywall wall frame",
      wall_glue: "drywall board installation",
      partition_1_layer: "drywall partition, 1 layer",
      partition_2_layer: "drywall partition, 2 layers",
      demolition_with_lift: "tile removal, building with lift",
      demolition_no_lift: "tile removal, no lift",
      leveling: "surface leveling for tiling",
      tile_10_15: "tile installation 10x15",
      tile_30_60: "tile installation 30x60",
      tile_60_120: "tile installation 60x120",
      mosaic: "mosaic installation",
      stone: "stone installation",
      waterproofing: "waterproofing",
      laminate: "laminate",
      parquet_glue: "parquet (glue)",
      parquet_click: "parquet (click)",
      carpet: "carpet",
      water_point: "water point",
      heating_point: "heating point",
      toilet_install: "toilet install",
      shower_install: "shower install",
      electric_point: "electric point",
      socket_install: "socket install",
      light_install: "light install",
    }),
    confirmCopy: Object.freeze({
      default: "Estimate confirmed and ready to hand over to a manager.",
      sent: "Estimate confirmed and sent to CRM/manager.",
      pending:
        "Estimate confirmed. CRM delivery is queued and will be retried automatically.",
      failed:
        "Estimate confirmed, but CRM delivery failed. The system will retry.",
      not_configured: "Estimate confirmed, but CRM_WEBHOOK_URL is not configured.",
    }),
    errorPrefix: "Error",
    confirmErrorPrefix: "Confirmation error",
    noneLabel: "n/a",
  }),
  ru: Object.freeze({
    statusLabel: "\u0421\u0442\u0430\u0442\u0443\u0441",
    status: Object.freeze({
      active: "\u0430\u043a\u0442\u0438\u0432\u043d\u0430",
      needs_clarification: "\u0442\u0440\u0435\u0431\u0443\u0435\u0442 \u0443\u0442\u043e\u0447\u043d\u0435\u043d\u0438\u044f",
      ready_for_confirmation: "\u0433\u043e\u0442\u043e\u0432\u0430 \u043a \u043f\u043e\u0434\u0442\u0432\u0435\u0440\u0436\u0434\u0435\u043d\u0438\u044e",
      confirmed: "\u043f\u043e\u0434\u0442\u0432\u0435\u0440\u0436\u0434\u0435\u043d\u0430",
    }),
    estimateLabel: "\u0421\u043c\u0435\u0442\u0430",
    estimateTotalLabel: "\u041a \u043e\u043f\u043b\u0430\u0442\u0435",
    estimateNotReady:
      "\u043f\u043e\u044f\u0432\u0438\u0442\u0441\u044f \u043f\u043e\u0441\u043b\u0435 \u0443\u043a\u0430\u0437\u0430\u043d\u0438\u044f \u043a\u043b\u044e\u0447\u0435\u0432\u044b\u0445 \u0434\u0430\u043d\u043d\u044b\u0445",
    warningsLabel: "\u0417\u0430\u043c\u0435\u0442\u043a\u0438",
    sendLabel: "\u041e\u0442\u043f\u0440\u0430\u0432\u0438\u0442\u044c",
    confirmLabel: "\u041f\u043e\u0434\u0442\u0432\u0435\u0440\u0434\u0438\u0442\u044c \u0441\u043c\u0435\u0442\u0443",
    newChatLabel: "\u041d\u043e\u0432\u0430\u044f \u0441\u043c\u0435\u0442\u0430",
    placeholder:
      "\u041d\u0430\u043f\u0440.: \u0412\u0430\u043d\u043d\u0430\u044f 6\u043c2, \u0434\u0435\u043c\u043e\u043d\u0442\u0430\u0436 \u0441\u0442\u0430\u0440\u043e\u0439 \u043f\u043b\u0438\u0442\u043a\u0438, \u043f\u043b\u0438\u0442\u043a\u0430 60x60...",
    crmTitle: "CRM DTO (\u043f\u0440\u0435\u0434\u043f\u0440\u043e\u0441\u043c\u043e\u0442\u0440)",
    crmPreviewTitle: "CRM DTO",
    crmAvailableAfter:
      "\u0434\u043e\u0441\u0442\u0443\u043f\u043d\u043e \u043f\u043e\u0441\u043b\u0435 \u043f\u043e\u0434\u0442\u0432\u0435\u0440\u0436\u0434\u0435\u043d\u0438\u044f",
    crmFields: Object.freeze({
      sessionId: "sessionId",
      city: "\u0433\u043e\u0440\u043e\u0434",
      contact: "\u043a\u043e\u043d\u0442\u0430\u043a\u0442",
      note: "\u0437\u0430\u043c\u0435\u0442\u043a\u0430",
      total: "\u0438\u0442\u043e\u0433\u043e",
      delivery: "\u0434\u043e\u0441\u0442\u0430\u0432\u043a\u0430",
    }),
    deliveryStatus: Object.freeze({
      sent: "\u043e\u0442\u043f\u0440\u0430\u0432\u043b\u0435\u043d\u043e",
      pending: "\u0432 \u043e\u0447\u0435\u0440\u0435\u0434\u0438",
      failed: "\u043e\u0448\u0438\u0431\u043a\u0430",
      not_configured: "\u043d\u0435 \u043d\u0430\u0441\u0442\u0440\u043e\u0435\u043d\u043e",
      unknown: "\u043d\u0435\u0438\u0437\u0432\u0435\u0441\u0442\u043d\u043e",
    }),
    unitLabels: Object.freeze({
      m2: "\u043c2",
      pcs: "\u0448\u0442",
      order: "\u0437\u0430\u043a\u0430\u0437",
    }),
    workLabels: Object.freeze({
      project_design: "\u043f\u0440\u043e\u0435\u043a\u0442 \u0438 \u0437\u0430\u043c\u0435\u0440",
      preparation: "\u043f\u043e\u0434\u0433\u043e\u0442\u043e\u0432\u043a\u0430 \u043f\u043e\u0432\u0435\u0440\u0445\u043d\u043e\u0441\u0442\u0438",
      putty_2_layers: "\u0448\u043f\u0430\u043a\u043b\u0435\u0432\u043a\u0430, 2 \u0441\u043b\u043e\u044f",
      priming: "\u0433\u0440\u0443\u043d\u0442\u043e\u0432\u043a\u0430",
      primer_paint: "\u0433\u0440\u0443\u043d\u0442\u043e\u0432\u043a\u0430 \u0441 \u043f\u043e\u043a\u0440\u0430\u0441\u043a\u043e\u0439",
      paint_2_layers: "\u043f\u043e\u043a\u0440\u0430\u0441\u043a\u0430, 2 \u0441\u043b\u043e\u044f",
      wallpaper_install: "\u043f\u043e\u043a\u043b\u0435\u0439\u043a\u0430 \u043e\u0431\u043e\u0435\u0432",
      wallpaper_remove: "\u0441\u043d\u044f\u0442\u0438\u0435 \u043e\u0431\u043e\u0435\u0432",
      ceiling: "\u043f\u043e\u0434\u0432\u0435\u0441\u043d\u043e\u0439 \u043f\u043e\u0442\u043e\u043b\u043e\u043a \u0413\u041a",
      wall_frame: "\u043a\u0430\u0440\u043a\u0430\u0441 \u043f\u043e\u0434 \u0441\u0442\u0435\u043d\u0443 \u0413\u041a",
      wall_glue: "\u043c\u043e\u043d\u0442\u0430\u0436 \u043b\u0438\u0441\u0442\u043e\u0432 \u0413\u041a",
      partition_1_layer: "\u043f\u0435\u0440\u0435\u0433\u043e\u0440\u043e\u0434\u043a\u0430 \u0413\u041a, 1 \u0441\u043b\u043e\u0439",
      partition_2_layer: "\u043f\u0435\u0440\u0435\u0433\u043e\u0440\u043e\u0434\u043a\u0430 \u0413\u041a, 2 \u0441\u043b\u043e\u044f",
      demolition_with_lift: "\u0434\u0435\u043c\u043e\u043d\u0442\u0430\u0436 \u043f\u043b\u0438\u0442\u043a\u0438, \u0434\u043e\u043c \u0441 \u043b\u0438\u0444\u0442\u043e\u043c",
      demolition_no_lift: "\u0434\u0435\u043c\u043e\u043d\u0442\u0430\u0436 \u043f\u043b\u0438\u0442\u043a\u0438, \u0431\u0435\u0437 \u043b\u0438\u0444\u0442\u0430",
      leveling: "\u0432\u044b\u0440\u0430\u0432\u043d\u0438\u0432\u0430\u043d\u0438\u0435 \u043e\u0441\u043d\u043e\u0432\u0430\u043d\u0438\u044f \u043f\u043e\u0434 \u043f\u043b\u0438\u0442\u043a\u0443",
      tile_10_15: "\u0443\u043a\u043b\u0430\u0434\u043a\u0430 \u043f\u043b\u0438\u0442\u043a\u0438 10x15",
      tile_30_60: "\u0443\u043a\u043b\u0430\u0434\u043a\u0430 \u043f\u043b\u0438\u0442\u043a\u0438 30x60",
      tile_60_120: "\u0443\u043a\u043b\u0430\u0434\u043a\u0430 \u043f\u043b\u0438\u0442\u043a\u0438 60x120",
      mosaic: "\u0443\u043a\u043b\u0430\u0434\u043a\u0430 \u043c\u043e\u0437\u0430\u0438\u043a\u0438",
      stone: "\u0443\u043a\u043b\u0430\u0434\u043a\u0430 \u043a\u0430\u043c\u043d\u044f",
      waterproofing: "\u0433\u0438\u0434\u0440\u043e\u0438\u0437\u043e\u043b\u044f\u0446\u0438\u044f",
      laminate: "\u0443\u043a\u043b\u0430\u0434\u043a\u0430 \u043b\u0430\u043c\u0438\u043d\u0430\u0442\u0430",
      parquet_glue: "\u043f\u0430\u0440\u043a\u0435\u0442 (\u043a\u043b\u0435\u0439)",
      parquet_click: "\u043f\u0430\u0440\u043a\u0435\u0442 (\u0437\u0430\u043c\u043e\u043a)",
      carpet: "\u0443\u043a\u043b\u0430\u0434\u043a\u0430 \u043a\u043e\u0432\u0440\u043e\u043b\u0438\u043d\u0430",
      water_point: "\u0442\u043e\u0447\u043a\u0430 \u0432\u043e\u0434\u044b",
      heating_point: "\u0442\u043e\u0447\u043a\u0430 \u043e\u0442\u043e\u043f\u043b\u0435\u043d\u0438\u044f",
      toilet_install: "\u0443\u0441\u0442\u0430\u043d\u043e\u0432\u043a\u0430 \u0443\u043d\u0438\u0442\u0430\u0437\u0430",
      shower_install: "\u0443\u0441\u0442\u0430\u043d\u043e\u0432\u043a\u0430 \u0434\u0443\u0448\u0430",
      electric_point: "\u044d\u043b\u0435\u043a\u0442\u0440\u043e \u0442\u043e\u0447\u043a\u0430",
      socket_install: "\u0443\u0441\u0442\u0430\u043d\u043e\u0432\u043a\u0430 \u0440\u043e\u0437\u0435\u0442\u043a\u0438",
      light_install: "\u0443\u0441\u0442\u0430\u043d\u043e\u0432\u043a\u0430 \u0441\u0432\u0435\u0442\u0430",
    }),
    confirmCopy: Object.freeze({
      default:
        "\u0421\u043c\u0435\u0442\u0430 \u043f\u043e\u0434\u0442\u0432\u0435\u0440\u0436\u0434\u0435\u043d\u0430 \u0438 \u0433\u043e\u0442\u043e\u0432\u0430 \u043a \u043f\u0435\u0440\u0435\u0434\u0430\u0447\u0435 \u043c\u0435\u043d\u0435\u0434\u0436\u0435\u0440\u0443.",
      sent:
        "\u0421\u043c\u0435\u0442\u0430 \u043f\u043e\u0434\u0442\u0432\u0435\u0440\u0436\u0434\u0435\u043d\u0430 \u0438 \u043e\u0442\u043f\u0440\u0430\u0432\u043b\u0435\u043d\u0430 \u0432 CRM/\u043c\u0435\u043d\u0435\u0434\u0436\u0435\u0440\u0443.",
      pending:
        "\u0421\u043c\u0435\u0442\u0430 \u043f\u043e\u0434\u0442\u0432\u0435\u0440\u0436\u0434\u0435\u043d\u0430. \u041e\u0442\u043f\u0440\u0430\u0432\u043a\u0430 \u0432 CRM \u0432 \u043e\u0447\u0435\u0440\u0435\u0434\u0438 \u0438 \u0431\u0443\u0434\u0435\u0442 \u043f\u043e\u0432\u0442\u043e\u0440\u044f\u0442\u044c\u0441\u044f \u0430\u0432\u0442\u043e\u043c\u0430\u0442\u0438\u0447\u0435\u0441\u043a\u0438.",
      failed:
        "\u0421\u043c\u0435\u0442\u0430 \u043f\u043e\u0434\u0442\u0432\u0435\u0440\u0436\u0434\u0435\u043d\u0430, \u043d\u043e \u043e\u0442\u043f\u0440\u0430\u0432\u043a\u0430 \u0432 CRM \u043d\u0435 \u0443\u0434\u0430\u043b\u0430\u0441\u044c. \u0421\u0438\u0441\u0442\u0435\u043c\u0430 \u043f\u043e\u0432\u0442\u043e\u0440\u0438\u0442 \u043f\u043e\u043f\u044b\u0442\u043a\u0443.",
      not_configured:
        "\u0421\u043c\u0435\u0442\u0430 \u043f\u043e\u0434\u0442\u0432\u0435\u0440\u0436\u0434\u0435\u043d\u0430, \u043d\u043e CRM_WEBHOOK_URL \u043d\u0435 \u043d\u0430\u0441\u0442\u0440\u043e\u0435\u043d.",
    }),
    errorPrefix: "\u041e\u0448\u0438\u0431\u043a\u0430",
    confirmErrorPrefix: "\u041e\u0448\u0438\u0431\u043a\u0430 \u043f\u043e\u0434\u0442\u0432\u0435\u0440\u0436\u0434\u0435\u043d\u0438\u044f",
    noneLabel: "\u043d\u0435\u0442",
  }),
});

const UNIT_LABEL_OVERRIDES = Object.freeze({
  pl: Object.freeze({
    lm: "m/b",
    rib: "zeberko",
    module: "modul",
  }),
  en: Object.freeze({
    lm: "lm",
    rib: "rib",
    module: "module",
  }),
  ru: Object.freeze({
    lm: "м/п",
    rib: "ребро",
    module: "модуль",
  }),
});

const WORK_LABEL_OVERRIDES = Object.freeze({
  pl: Object.freeze({
    color_division: "odciecie kolorow",
    window_paint: "malowanie okien",
    door_paint: "malowanie drzwi",
    radiator_paint: "malowanie grzejnika",
    pipe_paint: "malowanie rur",
    coating_removal: "zdzieranie starych powlok",
    acrylic_corners: "akrylowanie naroznikow",
    touchups: "poprawki i zaprawki",
    ceiling_multi_level: "sufit GK, 2 poziomy i wiecej",
    attic_insulation: "ocieplenie poddasza z zabudowa GK",
    joint_fill: "wypelnienie spoin GK",
    joint_putty: "szpachlowanie spoin GK",
    box_install: "montaz boxow GK",
    corner_bead_install: "montaz perfokata",
    plinth_cut: "ukladanie cokolow z docinaniem",
    plinth_ready: "montaz gotowych cokolow",
    step_tile: "ukladanie plytek na stopniach",
    step_riser_tile: "ukladanie plytek na podstopnicach",
    decorative_tile: "montaz dekoru plytkowego",
    ceramic_hole: "otwor w plytce ceramicznej",
    gres_hole: "otwor w gresie",
    stone_hole: "otwor w kamieniu",
    brick_slip_install: "imitacja cegly z fugowaniem",
    corner_polish_45: "szlifowanie naroznikow 45 stopni",
    aluminum_trim_install: "montaz listew aluminiowych",
    revision_hatch_tile: "rewizja w plytce",
    tiled_shelf_install: "wykonanie i montaz polki z plytki",
    bathtub_enclosure: "obudowa wanny",
    shower_base_enclosure: "obudowa brodzika",
    water_point_demolition: "demontaz punktu wod-kan",
    fixture_demolition: "demontaz wanny, kabiny lub umywalki",
    shower_drain_point: "punkt wod-kan do brodzika",
    pipe_chasing: "wykonanie bruzd pod rury",
    water_line_install: "prowadzenie instalacji wodnej",
    toilet_frame_install: "montaz stelaza pod WC",
    concealed_mixer_install: "montaz baterii podtynkowej",
    standard_mixer_install: "montaz baterii natynkowej",
    bathtub_install: "montaz wanny",
    toilet_install: "montaz umywalki, WC lub bidetu",
    shower_base_install: "montaz brodzika",
    shower_install: "montaz kabiny prysznicowej",
    radiator_install: "montaz grzejnika",
    shower_glass_install: "montaz szyby prysznicowej",
    silicone_sealing: "uszczelnienie silikonem",
    mirror_install: "montaz lustra",
    glass_shelf_install: "montaz szklanej polki",
    cable_tray_install: "montaz korytka ocynkowanego",
    cable_routing: "prowadzenie kabla",
    socket_install: "montaz gniazdka lub wlacznika",
    electric_point_demolition: "demontaz punktu elektrycznego",
    wire_chasing: "wykonanie bruzdy pod przewody",
    switchboard_install: "montaz rozdzielnicy",
  }),
  en: Object.freeze({
    color_division: "color separation lines",
    window_paint: "window painting",
    door_paint: "door painting",
    radiator_paint: "radiator painting",
    pipe_paint: "pipe painting",
    coating_removal: "old coating removal",
    acrylic_corners: "acrylic corner finishing",
    touchups: "touch-ups and corrections",
    ceiling_multi_level: "multi-level drywall ceiling",
    attic_insulation: "attic insulation with drywall finish",
    joint_fill: "drywall joint filling",
    joint_putty: "drywall joint putty",
    box_install: "drywall box installation",
    corner_bead_install: "corner bead installation",
    plinth_cut: "tile skirting with cutting",
    plinth_ready: "ready-made plinth installation",
    step_tile: "tile installation on steps",
    step_riser_tile: "tile installation on risers",
    decorative_tile: "decorative tile strip installation",
    ceramic_hole: "hole in ceramic tile",
    gres_hole: "hole in porcelain tile",
    stone_hole: "hole in stone",
    brick_slip_install: "brick slip installation with grout",
    corner_polish_45: "45-degree edge polishing",
    aluminum_trim_install: "aluminum trim installation",
    revision_hatch_tile: "tiled revision hatch",
    tiled_shelf_install: "tiled shelf build and install",
    bathtub_enclosure: "bathtub enclosure",
    shower_base_enclosure: "shower base enclosure",
    water_point_demolition: "water point demolition",
    fixture_demolition: "bathtub, shower or sink demolition",
    shower_drain_point: "water point for shower base drain",
    pipe_chasing: "pipe chasing",
    water_line_install: "water line installation",
    toilet_frame_install: "toilet frame installation",
    concealed_mixer_install: "concealed mixer installation",
    standard_mixer_install: "standard mixer installation",
    bathtub_install: "bathtub installation",
    toilet_install: "sink / toilet / bidet installation",
    shower_base_install: "shower base installation",
    shower_install: "shower cabin installation",
    radiator_install: "radiator installation",
    shower_glass_install: "shower glass installation",
    silicone_sealing: "silicone sealing",
    mirror_install: "mirror installation",
    glass_shelf_install: "glass shelf installation",
    cable_tray_install: "galvanized cable tray installation",
    cable_routing: "cable routing",
    socket_install: "socket / switch installation",
    electric_point_demolition: "electric point demolition",
    wire_chasing: "wire chasing",
    switchboard_install: "switchboard installation",
  }),
  ru: Object.freeze({
    color_division: "разделение цветов",
    window_paint: "покраска окон",
    door_paint: "покраска дверей",
    radiator_paint: "покраска радиаторов",
    pipe_paint: "покраска труб",
    coating_removal: "снятие старого покрытия",
    acrylic_corners: "проход углов акрилом",
    touchups: "поправки",
    ceiling_multi_level: "многоуровневый потолок ГК",
    attic_insulation: "утепление мансарды с зашивкой ГК",
    joint_fill: "заделка швов ГК",
    joint_putty: "шпаклевание швов ГК",
    box_install: "монтаж коробов ГК",
    corner_bead_install: "монтаж перфоуглов",
    plinth_cut: "укладка цоколя с подрезкой",
    plinth_ready: "монтаж готового цоколя",
    step_tile: "укладка плитки на ступени",
    step_riser_tile: "укладка плитки на подступенки",
    decorative_tile: "монтаж декора или вставки из плитки",
    ceramic_hole: "отверстие в керамической плитке",
    gres_hole: "отверстие в керамограните",
    stone_hole: "отверстие в камне",
    brick_slip_install: "имитация кирпича с затиркой",
    corner_polish_45: "запил угла 45 градусов",
    aluminum_trim_install: "монтаж алюминиевых планок",
    revision_hatch_tile: "ревизионный люк в плитке",
    tiled_shelf_install: "изготовление и монтаж полки из плитки",
    bathtub_enclosure: "облицовка ванны",
    shower_base_enclosure: "облицовка поддона",
    water_point_demolition: "демонтаж точки водо-канализации",
    fixture_demolition: "демонтаж ванны, кабины или умывальника",
    shower_drain_point: "точка водо-канализации для душевого поддона",
    pipe_chasing: "штробы под трубы",
    water_line_install: "прокладка водяных трасс",
    toilet_frame_install: "монтаж стеллажа под подвесной унитаз",
    concealed_mixer_install: "монтаж скрытого смесителя",
    standard_mixer_install: "монтаж обычного смесителя",
    bathtub_install: "монтаж ванны",
    toilet_install: "монтаж умывальника, унитаза или биде",
    shower_base_install: "монтаж поддона",
    shower_install: "монтаж душевой кабины",
    radiator_install: "монтаж радиатора",
    shower_glass_install: "монтаж стекла для душа",
    silicone_sealing: "герметизация силиконом",
    mirror_install: "монтаж зеркала",
    glass_shelf_install: "монтаж стеклянной полки",
    cable_tray_install: "монтаж оцинкованного корыта",
    cable_routing: "прокладка кабеля",
    socket_install: "монтаж розеток и выключателей",
    electric_point_demolition: "демонтаж электроточки",
    wire_chasing: "штробы под провода",
    switchboard_install: "монтаж электрощитовой",
  }),
});

const messagesEl = document.getElementById("messages");
const statusEl = document.getElementById("status");
const estimateEl = document.getElementById("estimate");
const crmResultEl = document.getElementById("crmResult");
const chatForm = document.getElementById("chatForm");
const messageInput = document.getElementById("messageInput");
const sendBtn = document.getElementById("sendBtn");
const confirmBtn = document.getElementById("confirmBtn");
const newChatBtn = document.getElementById("newChatBtn");

function getLanguagePack(language) {
  return LANGUAGE_PACKS[language] ?? LANGUAGE_PACKS.pl;
}

function getLocale(language) {
  return LOCALES[language] ?? LOCALES.pl;
}

function formatWorkName(name) {
  const pack = getLanguagePack(state.language);
  const overrideLabel = WORK_LABEL_OVERRIDES[state.language]?.[name];
  const label = overrideLabel ?? pack.workLabels?.[name];
  if (label) {
    return label;
  }

  return String(name ?? "").replace(/_/g, " ");
}

function formatUnit(unit) {
  const pack = getLanguagePack(state.language);
  return (
    UNIT_LABEL_OVERRIDES[state.language]?.[unit] ??
    pack.unitLabels?.[unit] ??
    unit
  );
}

function formatNumber(value, { maximumFractionDigits = 2 } = {}) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) {
    return String(value ?? "");
  }

  return new Intl.NumberFormat(getLocale(state.language), {
    minimumFractionDigits: 0,
    maximumFractionDigits,
  }).format(numericValue);
}

function formatMoney(value) {
  return `${formatNumber(value)} PLN`;
}

function formatDeliveryStatus(status) {
  const pack = getLanguagePack(state.language);
  return pack.deliveryStatus?.[status] ?? status;
}

function setLanguage(language) {
  state.language = language ?? state.language ?? "pl";
  const pack = getLanguagePack(state.language);

  if (sendBtn) {
    sendBtn.textContent = pack.sendLabel;
  }
  if (confirmBtn) {
    confirmBtn.textContent = pack.confirmLabel;
  }
  if (newChatBtn) {
    newChatBtn.textContent = pack.newChatLabel ?? "New estimate";
  }
  if (messageInput) {
    messageInput.placeholder = pack.placeholder;
  }

  setStatus(state.status);
  renderEstimate({ estimate: state.lastEstimate, status: state.status });
    crmResultEl.innerHTML = `<strong>${pack.crmPreviewTitle}:</strong> ${pack.crmAvailableAfter}`;
}

function scrollMessagesToBottom({ smooth = true } = {}) {
  if (!messagesEl) {
    return;
  }

  const behavior = smooth ? "smooth" : "auto";
  requestAnimationFrame(() => {
    messagesEl.scrollTo({
      top: messagesEl.scrollHeight,
      behavior,
    });
  });
}

function appendMessage(text, role) {
  const item = document.createElement("div");
  item.className = `msg msg--${role}`;
  item.textContent =
    role === "assistant" ? normalizeAssistantMessage(text) : String(text ?? "");
  messagesEl.appendChild(item);
  scrollMessagesToBottom();
}

function setStatus(status) {
  const pack = getLanguagePack(state.language);
  const label = pack.status[status] ?? status;
  statusEl.innerHTML = `<strong>${pack.statusLabel}:</strong> ${label}`;
}

function normalizeAssistantMessage(text) {
  const raw = String(text ?? "");
  if (!raw) {
    return raw;
  }

  const withBullets = raw.replace(/\s*[\u2022\u00b7]\s*/g, "\n- ");
  const inlineHyphenCount = (withBullets.match(/\s-\s/g) ?? []).length;
  if (inlineHyphenCount >= 2 && !withBullets.includes("\n- ")) {
    return withBullets.replace(/\s-\s/g, "\n- ");
  }

  return withBullets;
}

function renderEstimate(payload) {
  const pack = getLanguagePack(state.language);
  const estimate = payload?.estimate;
  const status = String(payload?.status ?? state.status ?? "");
  const isFinalizable =
    status === "ready_for_confirmation" || status === "confirmed";

  if (!estimate || !isFinalizable) {
    estimateEl.innerHTML =
      `<strong>${pack.estimateLabel}:</strong> ${pack.estimateNotReady}`;
    return;
  }

  const rows = (estimate.breakdown ?? [])
    .map(
      (line) =>
        `<li>${formatWorkName(line.name)}: ${formatNumber(line.quantity, {
          maximumFractionDigits: 4,
        })} ${formatUnit(
          line.unit,
        )} x ${formatMoney(line.unitPrice)} = ${formatMoney(line.total)}</li>`,
    )
    .join("");

  estimateEl.innerHTML = `
    <strong>${pack.estimateLabel}:</strong>
    <div>${pack.estimateTotalLabel}: ${formatMoney(estimate.total)}</div>
    ${rows ? `<ul>${rows}</ul>` : ""}
  `;
}

function renderWarnings(payload) {
  if (!payload?.warnings?.length) {
    return;
  }

  const pack = getLanguagePack(state.language);
  appendMessage(`${pack.warningsLabel}: ${payload.warnings.join(" | ")}`, "assistant");
}

function renderResponse(payload) {
  state.sessionId = payload.sessionId ?? state.sessionId;
  state.status = payload.status ?? state.status;
  state.lastEstimate = payload.estimate ?? state.lastEstimate;
  state.language = payload.language ?? state.language;
  setLanguage(state.language);

  setStatus(state.status);

  if (payload.assistantMessage) {
    appendMessage(payload.assistantMessage, "assistant");
  }

  renderEstimate(payload);
  renderWarnings(payload);
  confirmBtn.disabled = state.status !== "ready_for_confirmation";
  scrollMessagesToBottom();
}

async function postJson(url, body) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const raw = await response.text();
  let payload = {};
  try {
    payload = raw ? JSON.parse(raw) : {};
  } catch (error) {
    throw new Error(`Serwer zwrocil niepoprawna odpowiedz (${response.status}).`);
  }

  if (!response.ok) {
    throw new Error(payload.error || `HTTP ${response.status}`);
  }

  return payload;
}

async function handleSend(message) {
  appendMessage(message, "user");

  sendBtn.disabled = true;
  confirmBtn.disabled = true;

  try {
    let payload;
    if (!state.sessionId) {
      payload = await postJson("/api/chat/start", { message });
    } else {
      payload = await postJson("/api/chat/message", {
        sessionId: state.sessionId,
        message,
      });
    }

    renderResponse(payload);
  } catch (error) {
    const pack = getLanguagePack(state.language);
    appendMessage(`${pack.errorPrefix}: ${error.message}`, "assistant");
  } finally {
    sendBtn.disabled = false;
    confirmBtn.disabled = state.status !== "ready_for_confirmation";
  }
}

function resetConversation() {
  state.sessionId = null;
  state.status = "active";
  state.lastEstimate = null;

  messagesEl.innerHTML = "";
  setStatus(state.status);
  renderEstimate({ estimate: null, status: state.status });
  confirmBtn.disabled = true;
  sendBtn.disabled = false;
  crmResultEl.innerHTML = `<strong>${getLanguagePack(state.language).crmPreviewTitle}:</strong> ${getLanguagePack(state.language).crmAvailableAfter}`;
  scrollMessagesToBottom({ smooth: false });
}

async function handleConfirm() {
  if (!state.sessionId) {
    return;
  }

  confirmBtn.disabled = true;

  try {
    const payload = await postJson("/api/estimate/confirm", {
      sessionId: state.sessionId,
      sendToCrm: true,
    });

    state.status = payload.status ?? "confirmed";
    setStatus(state.status);

    const crmStatus = String(
      payload?.crmResult?.status ?? payload?.crmResult?.mode ?? "unknown",
    ).toLowerCase();
    const pack = getLanguagePack(state.language);
    let confirmationCopy = pack.confirmCopy.default;

    if (crmStatus === "sent") {
      confirmationCopy = pack.confirmCopy.sent;
    } else if (crmStatus === "pending") {
      confirmationCopy = pack.confirmCopy.pending;
    } else if (crmStatus === "failed") {
      confirmationCopy = pack.confirmCopy.failed;
    } else if (crmStatus === "not_configured") {
      confirmationCopy = pack.confirmCopy.not_configured;
    }

    appendMessage(confirmationCopy, "assistant");

    const crmCustomer = payload?.crmLead?.customer ?? {};
    const contactSummary = [crmCustomer.phone, crmCustomer.email]
      .filter(Boolean)
      .join(" / ");

    const crmLabels = pack.crmFields;
    const noneLabel = pack.noneLabel;
    const deliveryStatus = formatDeliveryStatus(
      String(payload?.crmResult?.status ?? payload?.crmResult?.mode ?? "unknown"),
    );
    crmResultEl.innerHTML = `
      <strong>${pack.crmTitle}:</strong>
      <div>${crmLabels.sessionId}: ${payload.crmLead.sessionId}</div>
      <div>${crmLabels.city}: ${crmCustomer.city ?? noneLabel}</div>
      <div>${crmLabels.contact}: ${contactSummary || noneLabel}</div>
      <div>${crmLabels.note}: ${crmCustomer.note ?? noneLabel}</div>
      <div>${crmLabels.total}: ${formatNumber(payload.crmLead.estimate.total)} ${payload.crmLead.estimate.currency}</div>
      <div>${crmLabels.delivery}: ${deliveryStatus}</div>
    `;
  } catch (error) {
    const pack = getLanguagePack(state.language);
    appendMessage(`${pack.confirmErrorPrefix}: ${error.message}`, "assistant");
  } finally {
    confirmBtn.disabled = state.status !== "ready_for_confirmation";
    scrollMessagesToBottom();
  }
}

chatForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const message = messageInput.value.trim();
  if (!message) {
    return;
  }

  messageInput.value = "";
  await handleSend(message);
});

confirmBtn.addEventListener("click", handleConfirm);
newChatBtn.addEventListener("click", resetConversation);

setStatus("active");
setLanguage(state.language);
