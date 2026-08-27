import { insertWidget } from "./widgets.repository";
import { CreateWidgetInput, Widget } from "./widgets.types";

export async function createWidget(input: CreateWidgetInput): Promise<Widget> {
  return insertWidget(input);
}