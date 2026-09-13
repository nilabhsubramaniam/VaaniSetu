import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { LanguageSelector } from '../language-selector/language-selector';

@Component({
  selector: 'app-header',
  imports: [RouterLink, RouterLinkActive, LanguageSelector],
  templateUrl: './app-header.html',
  styleUrl: './app-header.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppHeader {}
