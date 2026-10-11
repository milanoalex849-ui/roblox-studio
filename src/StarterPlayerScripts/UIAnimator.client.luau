--!strict
-- UIAnimator: animates the instance-built UI in PlayerGui. It never builds UI. It only reads
-- attributes that the .model.json files put on instances and plays the matching animation.
--
-- GuiObject attributes
--   Anim      "Spin" | "Float" | "Pulse" | "Wiggle" | "Scroll"
--   AnimSpeed number  Spin: degrees/sec (20). Float/Pulse: cycles/sec (0.5 / 1). Scroll: px/sec (24). Wiggle: unused.
--   AnimAmount number Float: px (4). Pulse: scale (0.04). Wiggle: degrees (12).
--   AnimDelay number  phase offset in seconds, so neighbours don't move in lockstep (0)
--   AnimPause number  Wiggle: seconds between wiggles (2.5)
--   Stagger   number  pops in (in this order) whenever its Window opens
--
-- UIGradient attributes
--   Anim      "Sweep"  slides the gradient across its parent (a glint), then waits AnimPause (2.2) seconds
--
-- GuiButton attributes
--   Fx        "Chunky" (face of a depth-slab button: the parent scales, the face presses down by Depth px)
--             | "Pop" (the button itself scales)
--   Depth     number  press distance for "Chunky" (4)
--   Opens     string  name of a Window to open (toggles if it's already open)
--   Closes    string  name of a Window to close
--
-- Window attributes (on the window's root GuiObject)
--   Window    true    pops in whenever it becomes Visible, and pops out when closed through a Closes button
--   Blur      number  Lighting blur size while open (0 = none)
--   PopTarget string  name of the child that pops (default: the window itself). Use this when the
--                     window is a full-screen frame holding a scrim/backdrop plus the actual panel.
--   FadeIn    true    (on any descendant) fades in on open and out on close instead of popping

local Players = game:GetService("Players")
local RunService = game:GetService("RunService")
local TweenService = game:GetService("TweenService")
local UserInputService = game:GetService("UserInputService")
local Lighting = game:GetService("Lighting")

local player = Players.LocalPlayer
local playerGui = player:WaitForChild("PlayerGui")

local BACK = Enum.EasingStyle.Back
local QUAD = Enum.EasingStyle.Quad
local SINE = Enum.EasingStyle.Sine
local TAU = math.pi * 2

local bound: { [Instance]: boolean } = setmetatable({}, { __mode = "k" }) :: any
local runners: { [GuiObject]: (number) -> () } = {}
local closing: { [GuiObject]: boolean } = setmetatable({}, { __mode = "k" }) :: any
local openWindows: { [GuiObject]: number } = {}
local fadeBase: { [GuiObject]: number } = setmetatable({}, { __mode = "k" }) :: any

local function tween(obj: Instance, seconds: number, goal: { [string]: any }, style: Enum.EasingStyle?, direction: Enum.EasingDirection?): Tween
	local t = TweenService:Create(obj, TweenInfo.new(seconds, style or QUAD, direction or Enum.EasingDirection.Out), goal)
	t:Play()
	return t
end

local function num(obj: Instance, name: string, default: number): number
	local v = obj:GetAttribute(name)
	return if typeof(v) == "number" then v else default
end

local function str(obj: Instance, name: string): string?
	local v = obj:GetAttribute(name)
	return if typeof(v) == "string" and v ~= "" then v else nil
end

-- Animations share one UIScale per object. A UIScale authored in the model is reused.
local function getScale(obj: GuiObject): UIScale
	local existing = obj:FindFirstChildOfClass("UIScale")
	if existing then
		return existing
	end
	local scale = Instance.new("UIScale")
	scale.Name = "AnimScale"
	scale.Parent = obj
	return scale
end

local function isTouchOnly(): boolean
	return UserInputService.TouchEnabled and not UserInputService.MouseEnabled
end

---------------------------------------------------------------------------------------------------
-- Continuous animations

local function bindContinuous(obj: GuiObject, kind: string)
	local delay = num(obj, "AnimDelay", 0)
	local basePos = obj.Position
	local baseRot = obj.Rotation

	if kind == "Spin" then
		local speed = num(obj, "AnimSpeed", 20)
		runners[obj] = function(t)
			obj.Rotation = (baseRot + (t + delay) * speed) % 360
		end
	elseif kind == "Float" then
		local speed, amount = num(obj, "AnimSpeed", 0.5), num(obj, "AnimAmount", 4)
		runners[obj] = function(t)
			obj.Position = basePos + UDim2.fromOffset(0, math.sin((t + delay) * speed * TAU) * amount)
		end
	elseif kind == "Pulse" then
		local speed, amount = num(obj, "AnimSpeed", 1), num(obj, "AnimAmount", 0.04)
		local scale = getScale(obj)
		runners[obj] = function(t)
			scale.Scale = 1 + math.sin((t + delay) * speed * TAU) * amount
		end
	elseif kind == "Wiggle" then
		local amount, pause = num(obj, "AnimAmount", 12), num(obj, "AnimPause", 2.5)
		local length = 0.6
		runners[obj] = function(t)
			local phase = ((t + delay) % (pause + length)) / length
			if phase < 1 then
				obj.Rotation = baseRot + math.sin(phase * TAU * 3) * amount * (1 - phase)
			else
				obj.Rotation = baseRot
			end
		end
	elseif kind == "Scroll" and obj:IsA("ImageLabel") then
		-- A tiled pattern that drifts diagonally forever. The image is one tile larger than its
		-- parent and slides by exactly one tile, so the loop is seamless. Put it inside a CanvasGroup
		-- with a UICorner to clip it to rounded corners.
		local tile = math.max(obj.TileSize.X.Offset, 1)
		local speed = num(obj, "AnimSpeed", 24)
		obj.Size = UDim2.new(1, tile, 1, tile)
		runners[obj] = function(t)
			local o = ((t + delay) * speed) % tile
			obj.Position = UDim2.fromOffset(-tile + o, -tile + o)
		end
	end
end

local function bindSweep(gradient: UIGradient)
	local pause = num(gradient, "AnimPause", 2.2)
	local delay = num(gradient, "AnimDelay", 0)
	task.spawn(function()
		task.wait(delay)
		while gradient.Parent do
			gradient.Offset = Vector2.new(-1, 0)
			local t = tween(gradient, 0.7, { Offset = Vector2.new(1, 0) }, SINE, Enum.EasingDirection.InOut)
			t.Completed:Wait()
			task.wait(pause)
		end
	end)
end

RunService.RenderStepped:Connect(function()
	local t = os.clock()
	for obj, run in runners do
		if obj.Parent == nil then
			runners[obj] = nil
		elseif obj.Visible then
			run(t)
		end
	end
end)

---------------------------------------------------------------------------------------------------
-- Windows

local function blurTarget(): number
	local size = 0
	for _, s in openWindows do
		size = math.max(size, s)
	end
	return size
end

local function updateBlur()
	local target = blurTarget()
	local blur = Lighting:FindFirstChild("UIBlur") :: BlurEffect?
	if not blur then
		if target == 0 then
			return
		end
		local created = Instance.new("BlurEffect")
		created.Name = "UIBlur"
		created.Size = 0
		created.Parent = Lighting
		blur = created
	end
	tween(blur :: BlurEffect, 0.25, { Size = target })
end

local function popTarget(window: GuiObject): GuiObject
	local name = str(window, "PopTarget")
	local child = name and window:FindFirstChild(name)
	return if child and child:IsA("GuiObject") then child else window
end

local function fadeProp(obj: GuiObject): string
	return if obj:IsA("ImageLabel") or obj:IsA("ImageButton") then "ImageTransparency" else "BackgroundTransparency"
end

local function fade(window: GuiObject, opening: boolean)
	for _, d in window:GetDescendants() do
		if d:IsA("GuiObject") and d:GetAttribute("FadeIn") == true then
			local prop = fadeProp(d)
			if fadeBase[d] == nil then
				fadeBase[d] = (d :: any)[prop]
			end
			if opening then
				(d :: any)[prop] = 1
				tween(d, 0.3, { [prop] = fadeBase[d] })
			else
				tween(d, 0.18, { [prop] = 1 })
			end
		end
	end
end

local function playOpen(window: GuiObject)
	fade(window, true)
	local scale = getScale(popTarget(window))
	scale.Scale = 0.55
	tween(scale, 0.38, { Scale = 1 }, BACK)

	for _, d in window:GetDescendants() do
		local order = d:GetAttribute("Stagger")
		if typeof(order) == "number" and d:IsA("GuiObject") then
			local s = getScale(d)
			s.Scale = 0
			task.delay(0.12 + order * 0.06, function()
				tween(s, 0.32, { Scale = 1 }, BACK)
			end)
		end
	end

	openWindows[window] = num(window, "Blur", 0)
	updateBlur()
end

local function closeWindow(window: GuiObject)
	if closing[window] or not window.Visible then
		return
	end
	closing[window] = true
	openWindows[window] = nil
	updateBlur()
	fade(window, false)
	local t = tween(getScale(popTarget(window)), 0.18, { Scale = 0 }, BACK, Enum.EasingDirection.In)
	t.Completed:Wait()
	window.Visible = false
	for obj, base in fadeBase do
		if obj:IsDescendantOf(window) then
			(obj :: any)[fadeProp(obj)] = base
		end
	end
	closing[window] = nil
end

local function bindWindow(window: GuiObject)
	window:GetPropertyChangedSignal("Visible"):Connect(function()
		if window.Visible and not closing[window] then
			playOpen(window)
		elseif not window.Visible then
			openWindows[window] = nil
			updateBlur()
		end
	end)
	if window.Visible then
		playOpen(window)
	end
end

local function findWindow(from: Instance, name: string): GuiObject?
	local gui = from:FindFirstAncestorOfClass("ScreenGui")
	local found = (gui and gui:FindFirstChild(name, true)) or playerGui:FindFirstChild(name, true)
	if found and found:IsA("GuiObject") then
		return found
	end
	warn(`UIAnimator: no window named "{name}" for {from:GetFullName()}`)
	return nil
end

---------------------------------------------------------------------------------------------------
-- Buttons

local function bindButton(button: GuiButton)
	local fx = str(button, "Fx")
	local parent = button.Parent
	local chunky = fx == "Chunky" and parent ~= nil and parent:IsA("GuiObject")
	local target: GuiObject = if chunky then parent :: GuiObject else button
	local depth = num(button, "Depth", 4)
	local basePos = button.Position
	local hovering = false

	if fx then
		local scale = getScale(target)
		local function release()
			local hoverScale = if hovering and not isTouchOnly() then 1.06 else 1
			tween(scale, 0.22, { Scale = hoverScale }, BACK)
			if chunky then
				tween(button, 0.14, { Position = basePos }, BACK)
			end
		end
		button.MouseEnter:Connect(function()
			hovering = true
			tween(scale, 0.18, { Scale = 1.06 }, BACK)
		end)
		button.MouseLeave:Connect(function()
			hovering = false
			tween(scale, 0.18, { Scale = 1 })
			if chunky then
				tween(button, 0.1, { Position = basePos })
			end
		end)
		button.MouseButton1Down:Connect(function()
			tween(scale, 0.08, { Scale = 0.95 })
			if chunky then
				tween(button, 0.06, { Position = basePos + UDim2.fromOffset(0, depth) })
			end
		end)
		button.MouseButton1Up:Connect(release)
	end

	local opens, closes = str(button, "Opens"), str(button, "Closes")
	if opens or closes then
		button.Activated:Connect(function()
			if closes then
				local window = findWindow(button, closes)
				if window then
					task.spawn(closeWindow, window)
				end
			end
			if opens then
				local window = findWindow(button, opens)
				if window then
					if window.Visible then
						task.spawn(closeWindow, window)
					else
						window.Visible = true
					end
				end
			end
		end)
	end
end

---------------------------------------------------------------------------------------------------

local function bind(inst: Instance)
	if bound[inst] then
		return
	end
	local anim = str(inst, "Anim")
	local isWindow = inst:GetAttribute("Window") == true
	local isButton = inst:IsA("GuiButton") and (str(inst, "Fx") or str(inst, "Opens") or str(inst, "Closes")) ~= nil
	if not (anim or isWindow or isButton) then
		return
	end
	bound[inst] = true

	if inst:IsA("UIGradient") then
		if anim == "Sweep" then
			bindSweep(inst)
		end
		return
	end
	if not inst:IsA("GuiObject") then
		return
	end
	if anim then
		bindContinuous(inst, anim)
	end
	if isButton then
		bindButton(inst :: GuiButton)
	end
	if isWindow then
		bindWindow(inst)
	end
end

for _, inst in playerGui:GetDescendants() do
	bind(inst)
end
playerGui.DescendantAdded:Connect(bind)
