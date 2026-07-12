<script setup lang="ts">
import { examplesUrl } from '../urls';

const installCode = `import { LlmIntegration } from '@llm-ui/vue'

<LlmIntegration name="shipping-form">
  <ExpressForm />
</LlmIntegration>`;

const directiveCode = `<a-input
  v-llm-field="{
    type: 'phone',
    aliases: ['phone', 'mobile', 'contact phone']
  }"
/>`;

const registerCode = `registerField({
  id: 'receiverPhone',
  label: 'Receiver phone',
  value,
  setValue,
  validate,
})`;

const principles = [
  ['Start from the existing UI', 'A scope can be created around an existing Vue subtree. The runtime scans what is already rendered.'],
  ['Metadata before vision', 'The component tree and DOM semantics are the primary context. Screenshot recognition is a fallback, not the base path.'],
  ['Generic tools, local context', 'Tools stay small. Fields, actions, and regions are passed as scoped metadata.'],
  ['Visible execution', 'The executor changes UI state step by step. Users can inspect the result before submit.'],
  ['Progressive hardening', 'DOM scan is the entry point. Directives and registered APIs are used when correctness matters.']
];

const levels = [
  { name: 'scan', title: 'Wrapper scan', api: '<LlmIntegration>', notes: ['scope boundary', 'DOM labels', 'inputs', 'buttons', 'regions'] },
  { name: 'hint', title: 'Directive hints', api: 'v-llm-field / v-llm-action', notes: ['semantic type', 'aliases', 'examples', 'risk'] },
  { name: 'register', title: 'Registered APIs', api: 'registerField / registerAction', notes: ['controlled state', 'validation', 'form API', 'stable execution'] },
  { name: 'reuse', title: 'Executor reuse', api: 'workflow / snapshot', notes: ['saved steps', 'visible replay', 'localStorage POC', 'future backend'] }
];

const architecture = [
  ['LlmProvider', 'client, policy, registry, assistant runtime'],
  ['LlmIntegration', 'scope lifecycle, scan, local metadata tree'],
  ['Directives', 'field/action hints without replacing components'],
  ['Executor', 'fill, focus, highlight, invoke, replay'],
  ['Assistant', 'global or local UI entry for the same runtime']
];

</script>

<template>
  <section id="top" class="hero">
    <div class="hero-copy">
      <p class="kicker">Progressive AI interaction for Vue</p>
      <h1>Make Vue interfaces readable and executable by AI.</h1>
      <p class="lead">
        Add a scope boundary. Collect metadata from the rendered UI. Use directives or registered APIs only where the default scan is not enough.
      </p>
      <div class="actions">
        <a class="button primary" href="#start">Start with one wrapper</a>
        <a class="button secondary" :href="examplesUrl">Open examples</a>
      </div>
    </div>
    <aside class="terminal" aria-label="quick start code">
      <div class="terminal-bar">
        <span></span><span></span><span></span>
        <strong>minimal.vue</strong>
      </div>
      <pre><code>{{ installCode }}</code></pre>
    </aside>
  </section>

  <section id="start" class="section split">
    <div>
      <p class="kicker">Minimum surface</p>
      <h2>One wrapper creates one AI scope.</h2>
      <p>
        The first integration point is a Vue subtree. The runtime scans labels, inputs, buttons, regions, validation text, and basic ARIA attributes inside that subtree.
      </p>
    </div>
    <div class="note-list">
      <div>
        <strong>No page-specific tools required at entry.</strong>
        <span>Fields and actions are discovered as metadata first.</span>
      </div>
      <div>
        <strong>No global exposure by default.</strong>
        <span>Scopes can be local, global, or private.</span>
      </div>
      <div>
        <strong>No submit by default.</strong>
        <span>The executor prepares visible UI state. Final commit remains explicit.</span>
      </div>
    </div>
  </section>

  <section id="model" class="section">
    <p class="kicker">Progressive model</p>
    <h2>Scan first. Register when it matters.</h2>
    <div class="levels">
      <article v-for="level in levels" :key="level.name" class="level">
        <code>{{ level.name }}</code>
        <h3>{{ level.title }}</h3>
        <p>{{ level.api }}</p>
        <ul>
          <li v-for="note in level.notes" :key="note">{{ note }}</li>
        </ul>
      </article>
    </div>
  </section>

  <section class="section code-pair">
    <div>
      <p class="kicker">Hint</p>
      <h2>Use directives when labels are not enough.</h2>
      <p>
        Directives add semantics without replacing the existing component or form implementation.
      </p>
    </div>
    <pre><code>{{ directiveCode }}</code></pre>
  </section>

  <section class="section code-pair reversed">
    <div>
      <p class="kicker">Register</p>
      <h2>Use registered APIs when state matters.</h2>
      <p>
        Controlled components, validation, and business actions should use explicit registration instead of DOM fallback.
      </p>
    </div>
    <pre><code>{{ registerCode }}</code></pre>
  </section>

  <section class="section examples-entry">
    <div>
      <p class="kicker">Examples</p>
      <h2>Examples live on a separate page.</h2>
      <p>
        The examples page is organized like a small lab: a left-side demo menu, a right-side scenario panel, and later an interactive runtime preview.
      </p>
    </div>
    <a class="button primary" :href="examplesUrl">Open examples</a>
  </section>

  <section id="runtime" class="section runtime">
    <div>
      <p class="kicker">Runtime</p>
      <h2>Local scopes, global assistant, shared executor.</h2>
      <p>
        Components can keep metadata local. The global assistant only sees scopes explicitly exposed to the global registry. Both paths use the same executor model.
      </p>
    </div>
    <table>
      <tbody>
        <tr v-for="row in architecture" :key="row[0]">
          <th>{{ row[0] }}</th>
          <td>{{ row[1] }}</td>
        </tr>
      </tbody>
    </table>
  </section>

  <section class="section principles">
    <p class="kicker">Design constraints</p>
    <h2>Constraints before features.</h2>
    <div class="principle-list">
      <article v-for="item in principles" :key="item[0]">
        <h3>{{ item[0] }}</h3>
        <p>{{ item[1] }}</p>
      </article>
    </div>
  </section>
</template>
