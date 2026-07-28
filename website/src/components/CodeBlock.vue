<script setup lang="ts">
import { computed } from 'vue';

const props = withDefaults(defineProps<{
  code: string;
  language?: 'vue' | 'typescript' | 'shell';
}>(), {
  language: 'typescript'
});

const tokenPattern = /(?<comment><!--[\s\S]*?-->|\/\*[\s\S]*?\*\/|\/\/[^\n]*)|(?<string>`(?:\\[\s\S]|[^`\\])*`|'(?:\\.|[^'\\])*'|"(?:\\.|[^"\\])*")|(?<tag><\/?[A-Za-z][\w.-]*)|(?<keyword>\b(?:as|async|await|break|case|catch|class|const|continue|default|delete|do|else|export|extends|false|finally|for|from|function|if|implements|import|in|instanceof|interface|let|new|null|of|return|satisfies|switch|throw|true|try|type|typeof|undefined|var|void|while|with|yield)\b)|(?<number>\b(?:0x[\da-f]+|\d+(?:\.\d+)?)\b)|(?<attribute>(?:v-|[:@])[\w:.-]+(?=\s*=)|\b[\w-]+(?=\s*=))|(?<function>\b[A-Za-z_$][\w$]*(?=\s*\())|(?<property>\b[A-Za-z_$][\w$]*(?=\s*:))/gi;

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function highlight(source: string) {
  let output = '';
  let offset = 0;

  for (const match of source.matchAll(tokenPattern)) {
    const index = match.index ?? 0;
    const type = Object.entries(match.groups ?? {}).find(([, value]) => value !== undefined)?.[0] ?? 'plain';
    output += escapeHtml(source.slice(offset, index));
    output += `<span class="syntax-${type}">${escapeHtml(match[0])}</span>`;
    offset = index + match[0].length;
  }

  return output + escapeHtml(source.slice(offset));
}

const highlighted = computed(() => highlight(props.code));
</script>

<template>
  <pre :class="['syntax-block', `language-${language}`]"><code v-html="highlighted"></code></pre>
</template>

<style scoped src="./CodeBlock.css"></style>
