extends Node3D

const FRAME_EXPRESSION := "window.parent.watteauTrialFrame || ''"
const REPORT_DRAW := "if (typeof window.parent.watteauTrialRendered === 'function') window.parent.watteauTrialRendered()"
const REPORT_READY := "window.watteauRendererReady = true; window.parent.postMessage({source:'watteau-godot',type:'ready'}, location.origin)"
const REPORT_ERROR := "window.parent.postMessage({source:'watteau-godot',type:'error'}, location.origin)"
const ACTIVE_COLOR := Color("#ffab88")
const IDLE_COLOR := Color("#85a8c2")

var camera := Camera3D.new()
var participant := Node3D.new()
var hips: Array[Node3D] = []
var knees: Array[Node3D] = []
var shoulders: Array[Node3D] = []
var pads: Array[StandardMaterial3D] = []
var last_raw := ""
var last_active := -1
var first_draw := true
var mesh_count := 0


func _ready() -> void:
	var decoded: Variant = JSON.parse_string(FileAccess.get_file_as_string("res://scene.json"))
	if not decoded is Dictionary:
		push_error("La géométrie partagée scene.json est illisible.")
		if OS.has_feature("web"):
			JavaScriptBridge.eval(REPORT_ERROR, true)
		get_tree().quit(1)
		return

	var layout: Dictionary = decoded
	_setup_lighting()
	_build_courtyard(layout)
	_build_participant()
	add_child(camera)
	camera.fov = 48.0
	camera.current = true
	var start: Dictionary = layout["start"]
	_update_frame({
		"x": start["x"], "z": start["z"], "yaw": PI,
		"walking": false, "step": 0.0, "active": 0, "reduced": false,
		"cameraX": start["x"], "cameraZ": start["z"],
	})
	print("Watteau Godot Compatibility: %d maillages, %d repères." % [mesh_count, pads.size()])
	if OS.has_feature("web"):
		RenderingServer.frame_post_draw.connect(_report_draw)


func _process(_delta: float) -> void:
	if not OS.has_feature("web"):
		return
	var raw: Variant = JavaScriptBridge.eval(FRAME_EXPRESSION, true)
	if not raw is String or raw.is_empty() or raw == last_raw:
		return

	last_raw = raw
	var frame: Variant = JSON.parse_string(raw)
	if frame is Dictionary:
		_update_frame(frame)


func _report_draw() -> void:
	if first_draw:
		first_draw = false
		JavaScriptBridge.eval(REPORT_READY, true)
	JavaScriptBridge.eval(REPORT_DRAW, true)


func _update_frame(frame: Dictionary) -> void:
	var x := float(frame["x"])
	var z := float(frame["z"])
	var walking := bool(frame["walking"]) and not bool(frame["reduced"])
	var gait := sin(float(frame["step"])) if walking else 0.0
	var bounce := 0.035 * absf(gait)
	participant.position = Vector3(x, bounce, z)
	participant.rotation.y = float(frame["yaw"])
	for index in range(2):
		var stride := gait * (1.0 if index == 0 else -1.0)
		hips[index].rotation.x = 0.46 * stride
		knees[index].rotation.x = -maxf(0.0, -stride) * 0.42
		shoulders[index].rotation.x = -0.54 * stride

	var active := int(frame["active"])
	if active != last_active:
		last_active = active
		for index in pads.size():
			pads[index].albedo_color = ACTIVE_COLOR if index == active else IDLE_COLOR
			pads[index].emission = pads[index].albedo_color

	var camera_x := float(frame["cameraX"])
	var camera_z := float(frame["cameraZ"])
	camera.position = Vector3(camera_x, 5.6, camera_z + 7.5)
	camera.look_at(Vector3(camera_x, 1.1, camera_z - 1.8))


func _setup_lighting() -> void:
	var environment := Environment.new()
	environment.background_mode = Environment.BG_COLOR
	environment.background_color = Color("#536c85")
	environment.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	environment.ambient_light_color = Color("#b2c9ec")
	environment.ambient_light_energy = 0.66
	var world_environment := WorldEnvironment.new()
	world_environment.environment = environment
	add_child(world_environment)

	var sun := DirectionalLight3D.new()
	sun.light_color = Color("#ffd0ad")
	sun.light_energy = 1.35
	sun.shadow_enabled = true
	sun.directional_shadow_mode = DirectionalLight3D.SHADOW_ORTHOGONAL
	sun.directional_shadow_max_distance = 28.0
	add_child(sun)
	sun.position = Vector3(-5.0, 10.0, 5.0)
	sun.look_at(Vector3.ZERO)


func _build_courtyard(layout: Dictionary) -> void:
	var world: Dictionary = layout["world"]
	var width := float(world["width"])
	var depth := float(world["depth"])
	var asphalt := _material("#344a57")
	var path := _material("#687584")
	var paving_line := _material("#3e5360")
	var roof := _material("#29394d")
	var foundation := _material("#2b4053")
	var window_frame := _material("#31475c")
	var warm_glazing := _material("#8e7f76")
	var cool_glazing := _material("#718f9e")
	var door := _material("#253744")
	var awning := _material("#7795a0")
	var soil := _material("#3f564f")
	var sunlit_leaves := _material("#648878")
	var shaded_leaves := _material("#527565")
	var plinth := _material("#425d6b")
	_box(self, Vector3(width + 5.0, 0.18, depth + 4.0), Vector3(0, -0.105, 0), asphalt, false)

	for area: Dictionary in layout["paths"]:
		_box(self, Vector3(area["w"], 0.027, area["d"]), Vector3(area["x"], 0.008, area["z"]), path, false)
	for x in range(-11, 12, 2):
		_box(self, Vector3(0.017, 0.01, depth - 0.2), Vector3(x, 0.002, 0), paving_line, false)
	for z in range(-7, 8, 2):
		_box(self, Vector3(width - 0.2, 0.01, 0.017), Vector3(0, 0.002, z), paving_line, false)

	for block: Dictionary in layout["buildings"]:
		var x := float(block["x"])
		var z := float(block["z"])
		var w := float(block["w"])
		var d := float(block["d"])
		var h := float(block["h"])
		var front := z + d / 2
		_box(self, Vector3(w, h, d), Vector3(x, h / 2, z), _material(block["color"]))
		_box(self, Vector3(w + 0.28, 0.18, d + 0.26), Vector3(x, h + 0.03, z), roof)
		_box(self, Vector3(w + 0.08, 0.18, 0.10), Vector3(x, 0.16, front + 0.03), foundation)
		for column in range(-2, 3):
			var pane_x := x + column * 1.04
			var glazing := warm_glazing if column % 2 else cool_glazing
			for row: float in [1.82, h - 0.83]:
				if row < 2.05 and column == 0:
					continue
				_box(self, Vector3(0.75, 0.62, 0.10), Vector3(pane_x, row, front + 0.018), window_frame)
				_box(self, Vector3(0.61, 0.46, 0.08), Vector3(pane_x, row, front + 0.078), glazing)
		_box(self, Vector3(1.02, 1.50, 0.14), Vector3(x, 0.75, front + 0.02), door)
		_box(self, Vector3(1.64, 0.13, 0.77), Vector3(x, 1.53, front + 0.30), awning)

	for obstacle: Dictionary in layout["obstacles"]:
		var x := float(obstacle["x"])
		var z := float(obstacle["z"])
		var w := float(obstacle["w"])
		var d := float(obstacle["d"])
		var h := float(obstacle["h"])
		_box(self, Vector3(w, h, d), Vector3(x, h / 2, z), _material(obstacle["color"]))
		_box(self, Vector3(w - 0.22, 0.035, d - 0.22), Vector3(x, h + 0.013, z), soil)
		for offset: float in [-0.95, -0.32, 0.32, 0.95]:
			var leaves := sunlit_leaves if offset > 0.0 else shaded_leaves
			_ball(self, Vector3(0.44, 0.39, 0.44), Vector3(x + offset, h + 0.18, z), leaves)

	for station: Dictionary in layout["stations"]:
		var x := float(station["x"])
		var z := float(station["z"])
		_pedestal(Vector3(x, 0.055, z), plinth)
		var beacon := _material("#85a8c2")
		beacon.emission_enabled = true
		beacon.emission_energy_multiplier = 0.18
		pads.append(beacon)
		_station_ring(Vector3(x, 0.125, z), beacon)


func _build_participant() -> void:
	add_child(participant)
	var hoodie := _material("#e4e5df")
	var burgundy := _material("#98485d")
	var skin := _material("#b17e65")
	var hair := _material("#49353c")
	var trousers := _material("#34475f")
	var sole := _material("#293743")
	var pack := _material("#35485b")
	var fittings := _material("#81919d")
	_capsule(participant, 0.205, 0.57, Vector3(0, 1.15, 0), Vector3(1, 1, 0.66), burgundy)
	_box(participant, Vector3(0.11, 0.33, 0.075), Vector3(0, 1.19, 0.122), hoodie)
	_ball(participant, Vector3(0.18, 0.10, 0.14), Vector3(0, 1.39, -0.016), hoodie)
	_ball(participant, Vector3(0.126, 0.147, 0.127), Vector3(0, 1.56, 0.018), skin)
	_ball(participant, Vector3(0.131, 0.106, 0.131), Vector3(0, 1.624, 0.004), hair)
	_box(participant, Vector3(0.27, 0.35, 0.13), Vector3(0, 1.20, -0.15), pack)
	_box(participant, Vector3(0.23, 0.035, 0.014), Vector3(0, 1.28, -0.222), fittings)

	for side in [-1.0, 1.0]:
		_ball(participant, Vector3(0.034, 0.065, 0.052), Vector3(side * 0.129, 1.55, 0.008), fittings)
		_box(participant, Vector3(0.026, 0.30, 0.024), Vector3(side * 0.15, 1.23, 0.112), pack)
		var hip := _pivot(participant, Vector3(side * 0.105, 0.88, 0))
		hips.append(hip)
		_capsule(hip, 0.075, 0.43, Vector3(0, -0.18, 0), Vector3.ONE, trousers)
		var knee := _pivot(hip, Vector3(0, -0.38, 0))
		knees.append(knee)
		_capsule(knee, 0.061, 0.36, Vector3(0, -0.17, 0), Vector3.ONE, trousers)
		_box(knee, Vector3(0.141, 0.05, 0.231), Vector3(0, -0.475, 0.035), sole)
		_box(knee, Vector3(0.132, 0.06, 0.206), Vector3(0, -0.422, 0.036), hoodie)
		var shoulder := _pivot(participant, Vector3(side * 0.225, 1.35, 0))
		shoulders.append(shoulder)
		_capsule(shoulder, 0.054, 0.44, Vector3(side * 0.026, -0.17, 0), Vector3.ONE, hoodie)
		_ball(shoulder, Vector3(0.043, 0.068, 0.046), Vector3(side * 0.026, -0.4, 0), skin)


func _material(tint: String) -> StandardMaterial3D:
	var material := StandardMaterial3D.new()
	material.albedo_color = Color(tint)
	material.roughness = 0.87
	return material


func _pivot(parent: Node3D, position: Vector3) -> Node3D:
	var pivot := Node3D.new()
	pivot.position = position
	parent.add_child(pivot)
	return pivot


func _mesh(parent: Node3D, geometry: Mesh, position: Vector3, material: Material,
		casts_shadow: bool = true) -> MeshInstance3D:
	var instance := MeshInstance3D.new()
	instance.mesh = geometry
	instance.position = position
	instance.material_override = material
	if not casts_shadow:
		instance.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	parent.add_child(instance)
	mesh_count += 1
	return instance


func _box(parent: Node3D, size: Vector3, position: Vector3, material: Material,
		casts_shadow: bool = true) -> void:
	var geometry := BoxMesh.new()
	geometry.size = size
	_mesh(parent, geometry, position, material, casts_shadow)


func _pedestal(position: Vector3, material: Material) -> void:
	var geometry := CylinderMesh.new()
	geometry.top_radius = 0.77
	geometry.bottom_radius = 0.82
	geometry.height = 0.11
	geometry.radial_segments = 32
	geometry.rings = 1
	_mesh(self, geometry, position, material)


func _station_ring(position: Vector3, material: Material) -> void:
	var geometry := TorusMesh.new()
	geometry.inner_radius = 0.592
	geometry.outer_radius = 0.648
	geometry.rings = 40
	geometry.ring_segments = 8
	_mesh(self, geometry, position, material, false)


func _ball(parent: Node3D, scale: Vector3, position: Vector3, material: Material) -> void:
	var geometry := SphereMesh.new()
	geometry.radius = 1.0
	geometry.height = 2.0
	geometry.radial_segments = 16
	geometry.rings = 8
	_mesh(parent, geometry, position, material).scale = scale


func _capsule(parent: Node3D, radius: float, height: float, position: Vector3, scale: Vector3,
		material: Material) -> void:
	var geometry := CapsuleMesh.new()
	geometry.radius = radius
	geometry.height = height
	geometry.radial_segments = 16
	geometry.rings = 5
	_mesh(parent, geometry, position, material).scale = scale
