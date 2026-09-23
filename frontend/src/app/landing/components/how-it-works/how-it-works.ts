import { ChangeDetectionStrategy, Component, input } from '@angular/core';

export interface HowItWorksStep {
  readonly title: string;
  readonly description: string;
}

@Component({
  selector: 'app-how-it-works',
  templateUrl: './how-it-works.html',
  styleUrl: './how-it-works.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HowItWorks {
  readonly heading = input.required<string>();
  readonly steps = input.required<readonly HowItWorksStep[]>();
}
