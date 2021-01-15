<script>
	import { tick } from "svelte";
	import { slide } from "svelte/transition";
	
	let unidades = [
		{'id':1, 'nome':'Metro(s)²', 'multiplicador': 1},
		{'id':2, 'nome':'Hectare(s)', 'multiplicador': 10000},
		{'id':3, 'nome':'Alqueire(s)', 'multiplicador': 24200},
		{'id':4, 'nome':'Alqueire(s) do Norte', 'multiplicador': 27225},
		{'id':5, 'nome':'Alqueire(s) Mineiro', 'multiplicador': 48400},
		{'id':5, 'nome':'Alqueire(s) Baiano', 'multiplicador': 96800},
	];
	let valorParaCalculo;
	let unidadeSelecionadaId = 1;
	
	// Toda vez que o valorParaCalculo ou unidadeSelecionadaId mudarem, o results é recalculado.
	$: results = valorParaCalculo && unidades.filter(unidade => unidade.id != unidadeSelecionadaId);
	
	// Toda vez que o unidadeSelecionadaId mudar, a unidadeSelecionada é filtrada novamente.
	$: unidadeSelecionada = unidades.find(unidade => unidade.id == unidadeSelecionadaId);
	
	// Função usada apenas para calcular os valores e mostrar na tela. 
	// Essa função é chamada direto no HTML lá em baixo, dentro do {#each}.
	function calcularMedida(multiplicador) {
		const result = (valorParaCalculo * unidadeSelecionada.multiplicador / multiplicador);
		
		if (isNaN(result)) {
			return "0,00";
		}
		return result.toFixed(4).toString().replace(".", ",");
	}
</script>
<style>

	body{
		color:#fff;
	}
</style>

<body>
	<div class="container">
		<div class="row justify-content-md-center">
			<h1 class="mt-5">Calculadora de Área</h1>
		</div>
		<div class="row justify-content-md-center">
			<h4>Faça o calculo automático de transformação de área.</h4>
		</div>
		<div class="row justify-content-md-center mt-4">
			<div class="col-6">
				<div class="input-group">
					<input type="number"  bind:value={valorParaCalculo} class="form-control" aria-label="Text input with dropdown button">
					<div class="input-group-append">
						<select id="unidade" bind:value={unidadeSelecionadaId}>
							{#each unidades as unidade}
							<option value="{unidade.id}">{unidade.nome}</option>
							{/each}
						</select>
					</div>
				</div>
			</div>
		</div>
			
			{#if valorParaCalculo}
				<div class="row mt-4 row justify-content-md-center mt-4" transition:slide={{ delay: 250, duration: 300 }}>
				{#each results as result}
					<span class="badge badge-pill badge-secondary m-2 p-3"><span style="font-size:20px;">{calcularMedida(result.multiplicador)} </span> {result.nome}</span>				
				{/each}
				</div>
			{/if}
			<div class="row mt-4 row justify-content-md-center mt-4">
				<div class="alert alert-info" role="alert">
				<h4>Insira um valor no campo para calcular</h4> 
					<br>Dados utilizados:<br>
					{#each unidades as unidade}
					<br>
						<b>1 {unidade.nome} </b> equivale a {unidade.multiplicador}m²,
					{/each}
			  </div>
			</div>
			<h3 class=" mt-2"> Dica do dia: Administre sua propriedade corretamente e comece a lucrar.</h3>
			<div style="position: relative; width: 100%; height: 0; padding-top: 56.2500%; padding-bottom: 48px; box-shadow: 0 2px 8px 0 rgba(63,69,81,0.16); margin-top: 1.6em; margin-bottom: 0.9em; overflow: hidden; border-radius: 8px; will-change: transform;">  <iframe style="position: absolute; width: 100%; height: 100%; top: 0; left: 0; border: none; padding: 0;margin: 0;"    src="https:&#x2F;&#x2F;www.canva.com&#x2F;design&#x2F;DAEP4JWTjOM&#x2F;view?embed">  </iframe></div>	</div>
</body>