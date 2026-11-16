<script setup>
defineProps({
    kind: {
        type: String,
        required: true,
        validator: (value) => ["loading", "empty", "error"].includes(value)
    },
    message: {
        type: String,
        default: ""
    }
});

defineEmits(["retry"]);
</script>

<template>
    <section class="state-panel" :class="`state-panel--${kind}`" aria-live="polite">
        <template v-if="kind === 'loading'">
            <span class="loading-mark" aria-hidden="true"></span>
            <h3>Cargando tareas</h3>
            <p>Estamos consultando el servicio.</p>
        </template>
        <template v-else-if="kind === 'empty'">
            <span class="empty-mark" aria-hidden="true">0</span>
            <h3>No hay tareas todavía</h3>
            <p>Agrega la primera actividad para comenzar a organizar el proyecto.</p>
        </template>
        <template v-else>
            <span class="error-mark" aria-hidden="true">!</span>
            <h3>No pudimos cargar las tareas</h3>
            <p>{{ message }}</p>
            <button class="button button-outline" type="button" @click="$emit('retry')">
                Reintentar
            </button>
        </template>
    </section>
</template>
