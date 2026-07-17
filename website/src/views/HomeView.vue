<script setup lang="ts">
import { examplesUrl } from '../urls';

const installCode = `<!-- Page.vue -->
<script setup>
import { Enchant } from '@enchantforge/vue'
import EnchantExpressForm from './EnchantExpressForm.vue'
${'</scr' + 'ipt>'}

<template>
  <Enchant name="shipping-form">
    <EnchantExpressForm />
  </Enchant>
</template>

<!-- EnchantExpressForm.vue -->
<script setup>
import { useEnchantForm } from '@enchantforge/vue'
import ExpressForm from './ExpressForm.vue'

const form = defineModel({ required: true })
useEnchantForm(form)
${'</scr' + 'ipt>'}

<template>
  <ExpressForm v-model="form" />
</template>`;

const directiveCode = `<Enchant scan="marked">
  <a-input v-enchant v-model:value="form.phone" />
</Enchant>`;

const registerCode = `useEnchantAction({
  name: 'form.reset',
  description: 'Reset the current form',
  effect: 'draft',
  execute: resetForm
})`;

const principles = [
  ['Explicit by default', 'A boundary aggregates component metadata and capabilities without reading its DOM.'],
  ['Stable contracts first', 'Vue contributions and component adapters take precedence over browser-level inference.'],
  ['Generic tools, local context', 'Tools stay small. Fields, actions, and regions are passed as scoped metadata.'],
  ['Visible execution', 'The executor changes UI state step by step. Users can inspect the result before submit.'],
  ['DOM is optional', 'Marked and full DOM scans are compatibility modes enabled by application code.']
];

const levels = [
  { name: 'contribute', title: 'Vue contribution', api: 'useEnchantForm / useEnchantAction', notes: ['controlled state', 'typed functions', 'component lifecycle', 'no DOM scan'] },
  { name: 'adapt', title: 'Component adapter', api: 'adapter plugins', notes: ['public component APIs', 'validation', 'stable execution', 'shared integration'] },
  { name: 'fallback', title: 'DOM compatibility', api: 'scan="marked" / scan="auto"', notes: ['explicit opt-in', 'legacy pages', 'lower confidence', 'browser events'] },
  { name: 'reuse', title: 'Executor reuse', api: 'workflow / snapshot', notes: ['saved steps', 'visible replay', 'localStorage POC', 'future backend'] }
];

const architecture = [
  ['EnchantForge', 'client, policy, registry, agent runtime'],
  ['Enchant', 'lifecycle, contribution boundary, local Enchantment'],
  ['Adapters', 'stable component metadata and executors'],
  ['Executor', 'fill, focus, highlight, invoke, replay'],
  ['Aura', 'application-level interaction over active Enchantments']
];

</script>

<template>
  <section id="top" class="hero">
    <div class="hero-copy">
      <p class="kicker">Progressive AI interaction for Vue</p>
      <h1>Make Vue interfaces readable and executable by AI.</h1>
      <p class="lead">
        Add a scope boundary. Components contribute metadata and constrained functions. DOM access remains an explicit compatibility option.
      </p>
      <div class="actions">
        <a class="button primary" href="#start">Start with one wrapper</a>
        <a class="button secondary" :href="examplesUrl">Open examples</a>
      </div>
    </div>
    <aside class="terminal" aria-label="quick start code">
      <div class="terminal-bar">
        <span></span><span></span><span></span>
        <strong>form-integration.vue</strong>
      </div>
      <pre><code>{{ installCode }}</code></pre>
    </aside>
  </section>

  <section id="start" class="section split">
    <div>
      <p class="kicker">Minimum surface</p>
      <h2>One wrapper creates one AI scope.</h2>
      <p>
        The first integration point is a Vue subtree. By default, the boundary only aggregates metadata and capabilities explicitly contributed by its descendants and installed adapters.
      </p>
    </div>
    <div class="note-list">
      <div>
        <strong>No DOM traversal by default.</strong>
        <span>Rendered markup is not treated as a stable component contract.</span>
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
    <h2>Contribute first. Scan only by choice.</h2>
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
      <p class="kicker">Marked fallback</p>
      <h2>Restrict DOM access to declared regions.</h2>
      <p>
        Marked scanning keeps the compatibility surface local and visible in source code.
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
