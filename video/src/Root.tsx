import React from "react";
import { Composition } from "remotion";
import { FamilyFlowPromo } from "./FamilyFlowPromo";
import { Video1_TaskLoot } from "./Video1_TaskLoot";
import { Video2_RecipeFlow } from "./Video2_RecipeFlow";
import { Video3_GrowingTree } from "./Video3_GrowingTree";
import { Video4_DayLife } from "./Video4_DayLife";
import { Video5_Competition } from "./Video5_Competition";
import { Video4_DayLife_Alt } from "./Video4_DayLife_Alt";
import { Video4_DayLife_Pro } from "./Video4_DayLife_Pro";

const SHARED = { durationInFrames: 900, fps: 30, width: 1080, height: 1920 };

export const Root: React.FC = () => {
  return (
    <>
      <Composition id="FamilyFlowPromo" component={FamilyFlowPromo} {...SHARED} />
      <Composition id="Video1-TaskLoot" component={Video1_TaskLoot} {...SHARED} />
      <Composition id="Video2-RecipeFlow" component={Video2_RecipeFlow} {...SHARED} />
      <Composition id="Video3-GrowingTree" component={Video3_GrowingTree} {...SHARED} />
      <Composition id="Video4-DayLife" component={Video4_DayLife} {...SHARED} />
      <Composition id="Video5-Competition" component={Video5_Competition} {...SHARED} />
      <Composition id="Video4-DayLife-Alt" component={Video4_DayLife_Alt} {...SHARED} />
      <Composition id="Video4-DayLife-Pro" component={Video4_DayLife_Pro} {...SHARED} />
    </>
  );
};
