const activityImageOverrides = {
  balaoi_visitor_attraction_fee_pagudpud: "balaoi_visitorattraction_fee_pagudpud.jpg",
  basilica_minore_del_santo_nino_cebu_city: "basilica_minore_del_santo_nio_cebu_city.jpg",
  bohol_chocolate_hills_tarsier_and_river_cruise_experience_from_tagbilaran: "bohol_chocolate_hills_tarsier_river_cruise_experience_from_tagbilaran.jpg",
  bohol_sikatuna_mirror_and_chocolate_hills_full_day_tour_with_loboc_river_cruise_from_tagbilaran: "bohol_sikatuna_mirror_chocolate_hills_full_day_tour_with_loboc_river_cruise_from_tagbilaran.jpg",
  cebu_private_bohol_full_day_tour_with_tickets_and_river_cruise_from_cebu_city: "cebu_private_bohol_full_day_tour_with_tickets_river_cruise_from_cebu_city.jpg",
  el_nido_tour_b_caves_and_islands_el_nido: "el_nido_tour_b_caves_islands_el_nido.jpg",
  el_nido_tour_d_lagoons_and_beaches_el_nido: "el_nido_tour_d_lagoons_beaches_el_nido.jpg",
  malacanang_of_the_north_and_chinese_garden_paoay: "malacaang_of_the_north_chinese_garden_paoay.jpg",
  museo_bacarra_and_bacarra_heritage_trail_bacarra: "museo_bacarra_bacarra_heritage_trail_bacarra.jpg",
  oslob_whale_shark_snorkeling_with_sardines_and_turtles_tour_in_cebu_from_cebu_city: "oslob_whale_shark_snorkeling_with_sardines_turtles_tour_in_cebu_from_cebu_city.jpg",
  oslob_whaleshark_and_badian_canyoneering_tour_packages_from_cebu_city: "oslob_whaleshark_badian_canyoneering_tour_packages_from_cebu_city.jpg",
  panglao_virgin_and_balicasag_islands_half_day_snorkeling_tour_panglao: "panglao_virgin_balicasag_islands_half_day_snorkeling_tour_panglao.jpg",
  private_cebu_and_mactan_twin_city_tour_cebu_city_lapu_lapu_city: "private_cebu_mactan_twin_city_tour_cebu_city_lapu_lapu_city.jpg",
  sentrong_pangkultura_ng_binan_plaza_rizal_binan_city: "sentrong_pangkultura_ng_bian_plaza_rizal_bian_city.jpg",
  umok_ni_siwawer_vintar_adventure_zipline_bikeline_vintar: "umok_ni_siwawer_vintar_adventure_ziplinebikeline_vintar.jpg",
};

export const getActivityImagePath = (activity, destination) => {
  const value = `${activity?.name || destination?.name || ""} ${destination?.name || ""}`
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\x00-\x7F]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

  const activityValue = `${activity?.name || ""}`
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\x00-\x7F]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  const recordTypes = [
    ...(Array.isArray(activity?.record_types) ? activity.record_types : []),
    activity?.record_type,
  ].filter(Boolean).join(" ");
  const isAccommodation = /hotel|room|accommodation|resort/i.test(recordTypes);

  if (isAccommodation && activityValue) {
    return `/activity%20pics/batch%202/${activityValue}.jpg`;
  }

  const filename = activityImageOverrides[value] || `${value}.jpg`;
  return value ? `/activity%20pics/${filename}` : "";
};
