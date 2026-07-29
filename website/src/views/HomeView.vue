<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import CodeBlock from '../components/CodeBlock.vue';
import { apiDocsUrl, examplesUrl } from '../urls';

const { t, tm } = useI18n();

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

const principles = ['explicit', 'stable', 'local', 'visible', 'optional'];

const levels = [
  { name: 'contribute', api: 'useEnchantForm / useEnchantAction' },
  { name: 'adapt', api: 'adapter plugins' },
  { name: 'fallback', api: 'scan="marked" / scan="auto"' },
  { name: 'reuse', api: 'workflow / snapshot' }
];

const architecture = [
  ['EnchantForge', 'forge'],
  ['Enchant', 'enchant'],
  ['Adapters', 'adapters'],
  ['Executor', 'executor'],
  ['Aura', 'aura']
];

function levelNotes(name: string) {
  return tm(`home.model.levels.${name}.notes`) as readonly string[];
}
</script>

<template>
  <section id="top" class="hero">
    <div class="hero-copy">
      <p class="kicker">{{ t('home.hero.kicker') }}</p>
      <h1>{{ t('home.hero.title') }}</h1>
      <p class="hero-problem">{{ t('home.hero.problem') }}</p>
      <p class="lead">{{ t('home.hero.lead') }}</p>
      <div class="actions">
        <a class="button primary" href="#start">{{ t('home.hero.start') }}</a>
        <a class="button secondary" :href="examplesUrl">{{ t('home.hero.examples') }}</a>
        <a class="button text" :href="apiDocsUrl">{{ t('home.hero.api') }} →</a>
      </div>
    </div>
    <aside class="terminal" aria-label="quick start code">
      <div class="terminal-bar">
        <span></span><span></span><span></span>
        <strong>form-integration.vue</strong>
      </div>
      <CodeBlock :code="installCode" language="vue" />
    </aside>
  </section>

  <section id="start" class="section split">
    <div>
      <p class="kicker">{{ t('home.minimum.kicker') }}</p>
      <h2>{{ t('home.minimum.title') }}</h2>
      <p>{{ t('home.minimum.body') }}</p>
    </div>
    <div class="note-list">
      <div>
        <strong>{{ t('home.minimum.notes.domTitle') }}</strong>
        <span>{{ t('home.minimum.notes.domBody') }}</span>
      </div>
      <div>
        <strong>{{ t('home.minimum.notes.globalTitle') }}</strong>
        <span>{{ t('home.minimum.notes.globalBody') }}</span>
      </div>
      <div>
        <strong>{{ t('home.minimum.notes.submitTitle') }}</strong>
        <span>{{ t('home.minimum.notes.submitBody') }}</span>
      </div>
    </div>
  </section>

  <section id="model" class="section">
    <p class="kicker">{{ t('home.model.kicker') }}</p>
    <h2>{{ t('home.model.title') }}</h2>
    <div class="levels">
      <article v-for="level in levels" :key="level.name" class="level">
        <code>{{ level.name }}</code>
        <h3>{{ t(`home.model.levels.${level.name}.title`) }}</h3>
        <p>{{ level.api }}</p>
        <ul>
          <li v-for="note in levelNotes(level.name)" :key="note">{{ note }}</li>
        </ul>
      </article>
    </div>
  </section>

  <section class="section code-pair">
    <div>
      <p class="kicker">{{ t('home.fallback.kicker') }}</p>
      <h2>{{ t('home.fallback.title') }}</h2>
      <p>{{ t('home.fallback.body') }}</p>
    </div>
    <CodeBlock :code="directiveCode" language="vue" />
  </section>

  <section class="section code-pair reversed">
    <div>
      <p class="kicker">{{ t('home.register.kicker') }}</p>
      <h2>{{ t('home.register.title') }}</h2>
      <p>{{ t('home.register.body') }}</p>
    </div>
    <CodeBlock :code="registerCode" language="typescript" />
  </section>

  <section class="section examples-entry">
    <div>
      <p class="kicker">{{ t('home.examples.kicker') }}</p>
      <h2>{{ t('home.examples.title') }}</h2>
      <p>{{ t('home.examples.body') }}</p>
    </div>
    <a class="button primary" :href="examplesUrl">{{ t('home.examples.action') }}</a>
  </section>

  <section id="runtime" class="section runtime">
    <div>
      <p class="kicker">{{ t('home.runtime.kicker') }}</p>
      <h2>{{ t('home.runtime.title') }}</h2>
      <p>{{ t('home.runtime.body') }}</p>
    </div>
    <table>
      <tbody>
        <tr v-for="row in architecture" :key="row[0]">
          <th>{{ row[0] }}</th>
          <td>{{ t(`home.runtime.rows.${row[1]}`) }}</td>
        </tr>
      </tbody>
    </table>
  </section>

  <section class="section principles">
    <p class="kicker">{{ t('home.principles.kicker') }}</p>
    <h2>{{ t('home.principles.title') }}</h2>
    <div class="principle-list">
      <article v-for="item in principles" :key="item">
        <h3>{{ t(`home.principles.${item}.title`) }}</h3>
        <p>{{ t(`home.principles.${item}.body`) }}</p>
      </article>
    </div>
  </section>
</template>
