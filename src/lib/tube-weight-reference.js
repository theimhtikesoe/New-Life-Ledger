export const TUBE_WEIGHT_REFERENCE = [
  {
    id: "13g",
    tubeType: ".3 Tube",
    gramsPerTube: 13,
    filledSackKg: 8.76,
    emptySackKg: 0.62,
  },
  {
    id: "24g",
    tubeType: "1 လီတာ Tube",
    gramsPerTube: 24,
    filledSackKg: 10.36,
    emptySackKg: 0.62,
  },
].map((item) => {
  const netTubeKg = item.filledSackKg - item.emptySackKg;
  return {
    ...item,
    netTubeKg,
    estimatedPieces: Math.round((netTubeKg * 1000) / item.gramsPerTube),
    grossEstimatedPieces: Math.round((item.filledSackKg * 1000) / item.gramsPerTube),
  };
});

export const TUBE_WEIGHT_NOTE = "ခြင်းအလေးချိန်သည် Tube ပါပြီးသား စုစုပေါင်းအလေးချိန်ဟုယူဆထားပြီး ခြင်းအလွတ် 0.62 kg ကိုနုတ်တွက်ထားသည်။";
