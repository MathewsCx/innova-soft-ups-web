<script setup>
defineProps({
    modelValue: {
        type: String,
        default: ""
    },
    search: {
        type: String,
        default: ""
    }
});

defineEmits(["update:modelValue", "update:search", "refresh"]);
</script>

<template>
    <div class="filters">
        <label class="search-field">
            <span class="sr-only">Buscar tareas por título o descripción</span>
            <input
                :value="search"
                type="search"
                placeholder="Buscar una tarea"
                @input="$emit('update:search', $event.target.value)"
            >
        </label>
        <label class="status-filter">
            <span class="sr-only">Filtrar por estado</span>
            <select
                :value="modelValue"
                @change="$emit('update:modelValue', $event.target.value)"
            >
                <option value="">Todos los estados</option>
                <option value="pendiente">Pendientes</option>
                <option value="en_progreso">En progreso</option>
                <option value="completado">Completadas</option>
            </select>
        </label>
        <button class="button button-refresh" type="button" @click="$emit('refresh')">
            Actualizar lista
        </button>
    </div>
</template>
