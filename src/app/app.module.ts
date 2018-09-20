import { BrowserModule } from '@angular/platform-browser';
import { NgModule } from '@angular/core';

import { RouterModule, Routes } from '@angular/router';
import { AppComponent } from './app.component';
import { DemoComponent } from './demo/demo.component';
import { TexthighlighterDirective } from './directives/texthighlighter.directive';

const appRoutes: Routes = [{ path: '', component: DemoComponent }];

@NgModule({
  declarations: [AppComponent, DemoComponent, TexthighlighterDirective],
  imports: [BrowserModule, RouterModule.forRoot(appRoutes)],
  providers: [],
  bootstrap: [AppComponent]
})
export class AppModule {}
